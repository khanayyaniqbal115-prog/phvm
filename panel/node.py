#!/usr/bin/env python3
"""
PHvm Node Agent v2.0
Run on additional hosts to register as compute nodes with the panel, and
actually create/run VMs there on the panel's behalf.

Usage:
  export PHvm_PANEL_URL=http://panel-ip:5050
  export PHvm_NODE_TOKEN=your_register_token   # set in Panel -> Settings -> Nodes
  export PHvm_NODE_NAME=node-2
  export PHvm_AGENT_PORT=5050
  python3 node.py

Requires on this host: qemu-system-x86, qemu-utils, cloud-image-utils, wget
(same as the main panel). Install with:
  sudo apt install -y qemu-system-x86 qemu-utils cloud-image-utils wget

The agent:
  - Registers with the panel, sends heartbeats (CPU/RAM/disk/KVM)
  - Exposes an API the panel calls to create/start/stop/delete VMs here,
    and to read live status/metrics — mirrors the panel's own local
    VMManager so a VM on this node behaves the same as a local one.
"""

import os, sys, time, socket, threading, json, subprocess, signal, re
from pathlib import Path
from datetime import datetime

try:
    import psutil
except ImportError:
    print("Install: pip install psutil flask requests")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("Install: pip install requests")
    sys.exit(1)

from flask import Flask, request, jsonify

PANEL_URL = os.environ.get('PHvm_PANEL_URL', 'http://127.0.0.1:5050').rstrip('/')
REGISTER_TOKEN = os.environ.get('PHvm_NODE_TOKEN', '')
NODE_NAME = os.environ.get('PHvm_NODE_NAME', socket.gethostname())
AGENT_PORT = int(os.environ.get('PHvm_AGENT_PORT', '5050'))
AGENT_HOST = os.environ.get('PHvm_AGENT_HOST', '0.0.0.0')
HEARTBEAT_SECS = int(os.environ.get('PHvm_HEARTBEAT', '30'))
AGENT_VERSION = '2.0'

VM_DIR = Path(os.environ.get('PHvm_VM_DIR', './vm_instances_node')).absolute()
VM_DIR.mkdir(exist_ok=True)

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)

node_token = None  # issued by panel after register
node_id = None

app = Flask(__name__)


# ─────────────────────────── helpers ───────────────────────────

def is_valid_uuid(val):
    return bool(val and isinstance(val, str) and _UUID_RE.match(val.strip()))

def safe_vm_id(vid):
    if not is_valid_uuid(vid):
        return None
    return vid.strip().lower()

def has_kvm():
    try:
        return os.path.exists('/dev/kvm') and os.access('/dev/kvm', os.R_OK | os.W_OK)
    except Exception:
        return False

def host_stats():
    return {
        'cpu_cores': psutil.cpu_count() or 1,
        'ram_mb': int(psutil.virtual_memory().total / (1024 * 1024)),
        'disk_gb': int(psutil.disk_usage('/').total / (1024 ** 3)),
        'has_kvm': has_kvm(),
        'hostname': socket.gethostname(),
    }

def check_auth(payload_or_headers):
    """Accept the token either as a JSON field `token` or an X-Node-Token header."""
    auth = request.headers.get('X-Node-Token', '') or (payload_or_headers.get('token') if isinstance(payload_or_headers, dict) else '')
    return bool(node_token) and auth == node_token


# ─────────────────────────── panel registration ───────────────────────────

def public_ip_guess():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return socket.gethostbyname(socket.gethostname())

def register():
    global node_token, node_id
    stats = host_stats()
    agent_ip = os.environ.get('PHvm_AGENT_IP') or public_ip_guess()
    api_url = os.environ.get('PHvm_AGENT_URL', f'http://{agent_ip}:{AGENT_PORT}')
    payload = {
        'token': REGISTER_TOKEN,
        'name': NODE_NAME,
        'hostname': os.environ.get('PHvm_AGENT_HOSTNAME', agent_ip),
        'api_url': api_url,
        'has_kvm': stats['has_kvm'],
        'cpu_cores': stats['cpu_cores'],
        'ram_mb': stats['ram_mb'],
        'disk_gb': stats['disk_gb'],
        'agent_version': AGENT_VERSION,
    }
    r = requests.post(f'{PANEL_URL}/api/node/register', json=payload, timeout=15)
    r.raise_for_status()
    data = r.json()
    if not data.get('success'):
        raise RuntimeError(data.get('message', 'register failed'))
    node_token = data['node_token']
    node_id = data.get('node_id')
    print(f"[OK] Registered as node_id={node_id} name={NODE_NAME} api_url={api_url}")
    return data

def heartbeat_loop():
    while True:
        try:
            if not node_token:
                time.sleep(5)
                continue
            stats = host_stats()
            payload = {'token': node_token, **stats}
            requests.post(f'{PANEL_URL}/api/node/heartbeat', json=payload, timeout=10)
        except Exception as e:
            print(f"[heartbeat] {e}")
        time.sleep(HEARTBEAT_SECS)

def report_progress(vm_id, progress, step):
    try:
        requests.post(f'{PANEL_URL}/api/node/vm-progress',
                      json={'token': node_token, 'vm_id': vm_id, 'progress': progress, 'step': step},
                      timeout=10)
    except Exception as e:
        print(f"[progress-report] {e}")


# ─────────────────────────── VM management (mirrors panel's VMManager) ───────────────────────────

class NodeVMManager:
    last_start_error = None

    def vm_dir(self, vid):
        vid = safe_vm_id(vid)
        if not vid:
            raise ValueError('Invalid VM id')
        d = (VM_DIR / vid).resolve()
        if not str(d).startswith(str(VM_DIR.resolve())):
            raise ValueError('Path escape blocked')
        d.mkdir(exist_ok=True)
        return d

    def download_image(self, vid, tmpl):
        report_progress(vid, 10, 'Downloading OS image...')
        d = self.vm_dir(vid)
        raw = d / 'disk.img'
        qcow = d / 'disk.qcow2'
        if qcow.exists() and qcow.stat().st_size > 50_000_000:
            report_progress(vid, 40, 'Image already present')
            return
        if not raw.exists() or raw.stat().st_size < 10_000_000:
            report_progress(vid, 15, f"Downloading {tmpl.get('name','image')}...")
            subprocess.run(['wget', '-q', '-O', str(raw), tmpl['url']], check=False, timeout=1800)
        report_progress(vid, 45, 'Converting to qcow2...')
        if qcow.exists():
            qcow.unlink()
        subprocess.run(['qemu-img', 'convert', '-f', 'qcow2', '-O', 'qcow2', str(raw), str(qcow)], check=False)
        if not qcow.exists() or qcow.stat().st_size < 10_000_000:
            subprocess.run(['qemu-img', 'convert', '-O', 'qcow2', str(raw), str(qcow)], check=False)
        report_progress(vid, 55, 'Image ready')

    def resize_disk(self, vid, gb):
        report_progress(vid, 60, f'Resizing disk to {gb}G...')
        qcow = self.vm_dir(vid) / 'disk.qcow2'
        if qcow.exists():
            subprocess.run(['qemu-img', 'resize', str(qcow), f'{gb}G'], check=False)

    def create_cloud_init(self, vid, tmpl, hostname, root_pw):
        d = self.vm_dir(vid)
        seed = d / 'seed.iso'
        report_progress(vid, 70, 'Creating cloud-init...')
        default_user = tmpl.get('default_user', 'ubuntu')
        root_pw = root_pw or tmpl.get('root_pass', 'phvm123')
        user_pw = root_pw
        ud = f"""#cloud-config
hostname: {hostname}
manage_etc_hosts: true
disable_root: false
ssh_pwauth: true
growpart:
  mode: auto
  devices: ['/']
resize_rootfs: true

chpasswd:
  list: |
    root:{root_pw}
    {default_user}:{user_pw}
  expire: false

users:
  - name: root
    lock_passwd: false
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
  - name: {default_user}
    lock_passwd: false
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
    groups: [sudo, adm]
    ssh_pwauth: true

write_files:
  - path: /etc/ssh/sshd_config.d/phvm.conf
    content: |
      PermitRootLogin yes
      PasswordAuthentication yes
      PubkeyAuthentication yes
      ChallengeResponseAuthentication no
    permissions: '0644'

packages:
  - cloud-guest-utils
  - curl
  - wget
  - git
  - vim
  - htop
  - net-tools
  - openssh-server
  - qemu-guest-agent

bootcmd:
  - echo 'root:{root_pw}' | chpasswd
  - echo '{default_user}:{user_pw}' | chpasswd
  - growpart /dev/vda 1 || growpart /dev/sda 1 || true
  - resize2fs /dev/vda1 || resize2fs /dev/sda1 || true

runcmd:
  - echo 'root:{root_pw}' | chpasswd
  - echo '{default_user}:{user_pw}' | chpasswd
  - growpart /dev/vda 1 || growpart /dev/sda 1 || true
  - resize2fs /dev/vda1 || resize2fs /dev/sda1 || true
  - sed -i 's/^#*PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
  - sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
  - systemctl enable ssh 2>/dev/null || true
  - systemctl restart ssh 2>/dev/null || service ssh restart 2>/dev/null || true
  - systemctl enable qemu-guest-agent 2>/dev/null || true
  - systemctl start qemu-guest-agent 2>/dev/null || true
"""
        md = f"instance-id: {vid}\nlocal-hostname: {hostname}\n"
        (d / 'user-data').write_text(ud)
        (d / 'meta-data').write_text(md)
        report_progress(vid, 80, 'Generating seed ISO...')
        if seed.exists():
            seed.unlink()
        subprocess.run(['cloud-localds', str(seed), str(d / 'user-data'), str(d / 'meta-data')], check=False)
        return str(seed)

    def start_vm(self, vid, ram, cpu, sp, vp, extra_forwards=None, nested_kvm=False):
        d = self.vm_dir(vid)
        img = d / 'disk.qcow2'
        seed = d / 'seed.iso'
        pf = d / 'qemu.pid'
        self.last_start_error = None
        if not img.exists() or img.stat().st_size < 1_000_000:
            self.last_start_error = 'Disk image missing or incomplete'
            return None
        if not seed.exists():
            self.last_start_error = 'Cloud-init seed.iso missing'
            return None
        try:
            vp = int(vp or 0)
        except Exception:
            vp = 0
        if not vp or vp < 1024:
            self.last_start_error = f'Invalid serial port: {vp}'
            return None

        ports_to_free = []
        if sp and int(sp) != 22:
            ports_to_free.append(int(sp))
        if extra_forwards:
            for fw in extra_forwards:
                hp = int(fw.get('host_port') or 0)
                if hp and hp != 22:
                    ports_to_free.append(hp)
        for port in ports_to_free:
            subprocess.run(['fuser', '-k', f'{port}/tcp'], capture_output=True)
        time.sleep(0.5)
        if pf.exists():
            try:
                os.kill(int(pf.read_text().strip()), signal.SIGKILL)
            except Exception:
                pass
            try:
                pf.unlink()
            except Exception:
                pass
        if is_valid_uuid(vid):
            subprocess.run(['pkill', '-f', f'qemu.*{vid}'], capture_output=True)
        time.sleep(0.5)

        use_kvm = has_kvm()
        nested = bool(nested_kvm) and use_kvm
        if use_kvm:
            accel_args = ['-enable-kvm', '-cpu', 'host,+vmx,+svm'] if nested else ['-enable-kvm', '-cpu', 'host']
        else:
            accel_args = ['-accel', 'tcg,thread=multi', '-cpu', 'qemu64']

        fw_parts = []
        if sp:
            fw_parts.append(f'hostfwd=tcp::{sp}-:22')
        if extra_forwards:
            for fw in extra_forwards:
                hp = int(fw.get('host_port') or 0)
                gp = int(fw.get('guest_port') or 0)
                proto = (fw.get('protocol') or 'tcp').lower()
                if hp and gp:
                    fw_parts.append(f'hostfwd={proto}::{hp}-:{gp}')
        netdev = 'user,id=net0,' + ','.join(fw_parts) if fw_parts else 'user,id=net0'

        qc = [
            'qemu-system-x86_64',
            '-name', vid,
            # See phvm.py's start_vm for why: reserve=off avoids the kernel
            # requiring the full RAM size reserved up front, which can fail
            # outright on a host whose total RAM is close to what's being
            # requested.
            '-object', f'memory-backend-ram,id=mem0,size={ram}M,reserve=off',
            '-machine', 'memory-backend=mem0',
            '-smp', str(cpu),
            *accel_args,
            '-display', 'none',
            '-drive', f'file={img},format=qcow2,if=virtio,cache=none,discard=unmap',
            '-drive', f'file={seed},format=raw,if=virtio,cache=none',
            '-netdev', netdev,
            '-device', 'virtio-net-pci,netdev=net0',
            '-device', 'virtio-balloon-pci',
            '-serial', f'telnet:127.0.0.1:{vp},server,nowait',
            '-daemonize',
            '-pidfile', str(pf)
        ]
        log = d / 'qemu.log'
        try:
            with open(log, 'w') as lf:
                proc = subprocess.Popen(qc, stdout=lf, stderr=subprocess.STDOUT)
                proc.wait(timeout=15)
        except FileNotFoundError:
            self.last_start_error = 'qemu-system-x86_64 not found on this node — install qemu-system-x86'
            return None
        except Exception as e:
            self.last_start_error = f'qemu launch error: {e}'
            return None
        for _ in range(20):
            if pf.exists():
                try:
                    pid = int(pf.read_text().strip())
                    os.kill(pid, 0)
                    return pid
                except Exception:
                    pass
            time.sleep(0.5)
        err = ''
        try:
            if log.exists():
                err = log.read_text(errors='replace')[-500:].strip()
        except Exception:
            pass
        self.last_start_error = err or 'QEMU exited without pidfile (port busy, bad disk, or missing KVM?)'
        return None

    def stop_vm(self, vid):
        pf = self.vm_dir(vid) / 'qemu.pid'
        pid = None
        if pf.exists():
            try:
                pid = int(pf.read_text().strip())
            except Exception:
                pid = None

        def _is_alive(p):
            try:
                os.kill(p, 0)
                return True
            except Exception:
                return False

        def _find_current_pid():
            if not is_valid_uuid(vid):
                return None
            try:
                r = subprocess.run(['pgrep', '-f', f'qemu.*{vid}'], capture_output=True, text=True)
                if r.stdout.strip():
                    return int(r.stdout.strip().split('\n')[0])
            except Exception:
                pass
            return None

        targets = [p for p in {pid, _find_current_pid()} if p]
        for p in targets:
            try:
                os.kill(p, signal.SIGTERM)
            except Exception:
                pass
        if targets:
            time.sleep(2)
        for p in targets:
            if _is_alive(p):
                try:
                    os.kill(p, signal.SIGKILL)
                except Exception:
                    pass
        time.sleep(0.5)
        still_alive = any(_is_alive(p) for p in targets) or (_find_current_pid() is not None)
        try:
            pf.unlink(missing_ok=True)
        except Exception:
            pass
        return not still_alive

    def destroy_vm(self, vid):
        try:
            self.stop_vm(vid)
        except Exception:
            pass
        try:
            d = self.vm_dir(vid)
            import shutil
            shutil.rmtree(d, ignore_errors=True)
        except Exception:
            pass

    def vm_status(self, vid):
        pf = self.vm_dir(vid) / 'qemu.pid'
        if pf.exists():
            try:
                pid = int(pf.read_text().strip())
                os.kill(pid, 0)
                return True, pid
            except Exception:
                try:
                    pf.unlink()
                except Exception:
                    pass
        try:
            r = subprocess.run(['pgrep', '-f', f'qemu.*{vid}'], capture_output=True, text=True) if is_valid_uuid(vid) else None
            if r is not None and r.stdout.strip():
                pid = int(r.stdout.strip().split('\n')[0])
                pf.write_text(str(pid))
                return True, pid
        except Exception:
            pass
        return False, None

    def vm_metrics(self, pid):
        if not pid:
            return None
        try:
            p = psutil.Process(pid)
            mem = p.memory_info()
            return {
                'cpu': round(p.cpu_percent(interval=0.5), 1),
                'ram_mb': round(mem.rss / (1024 * 1024), 0),
                'threads': p.num_threads(),
                'uptime': str(datetime.now() - datetime.fromtimestamp(p.create_time())).split('.')[0],
            }
        except Exception:
            return None


vmgr = NodeVMManager()


def _do_create(vid, tmpl, hostname, root_pw, ram, cpu, storage, sp, vp, extra_forwards, nested_kvm):
    try:
        vmgr.download_image(vid, tmpl)
        vmgr.resize_disk(vid, storage)
        vmgr.create_cloud_init(vid, tmpl, hostname, root_pw)
        report_progress(vid, 92, 'Starting VM...')
        pid = vmgr.start_vm(vid, ram, cpu, sp, vp, extra_forwards, nested_kvm)
        if pid:
            report_progress(vid, 100, 'Ready — VM is running')
        else:
            report_progress(vid, -1, vmgr.last_start_error or 'Failed to start')
    except Exception as e:
        report_progress(vid, -1, f'Node error: {e}')


# ─────────────────────────── HTTP API ───────────────────────────

@app.route('/health')
def health():
    return jsonify({'ok': True, 'node': NODE_NAME, 'node_id': node_id, 'has_kvm': has_kvm(), 'agent_version': AGENT_VERSION})


@app.route('/api/status')
def status():
    if not check_auth({}):
        return jsonify({'success': False}), 403
    return jsonify({'success': True, **host_stats(), 'node_id': node_id})


@app.route('/api/vm/create', methods=['POST'])
def api_vm_create():
    data = request.get_json(force=True, silent=True) or {}
    if not check_auth(data):
        return jsonify({'success': False, 'message': 'bad token'}), 403
    vid = safe_vm_id(data.get('vm_id'))
    if not vid:
        return jsonify({'success': False, 'message': 'invalid vm_id'}), 400
    tmpl = data.get('os_template') or {}
    if not tmpl.get('url'):
        return jsonify({'success': False, 'message': 'os_template.url required'}), 400
    hostname = data.get('hostname') or 'vm'
    root_pw = data.get('root_password') or ''
    ram = int(data.get('ram_mb') or 1024)
    cpu = int(data.get('cpu_cores') or 1)
    storage = int(data.get('storage_gb') or 20)
    sp = int(data.get('ssh_port') or 0)
    vp = int(data.get('serial_port') or 0)
    nested_kvm = bool(data.get('nested_kvm'))
    extra_forwards = data.get('extra_forwards') or []
    # Runs in background so this HTTP call returns immediately; progress is
    # streamed back to the panel via /api/node/vm-progress callbacks.
    threading.Thread(target=_do_create, args=(vid, tmpl, hostname, root_pw, ram, cpu, storage, sp, vp, extra_forwards, nested_kvm), daemon=True).start()
    return jsonify({'success': True, 'message': 'creation started'})


@app.route('/api/vm/start', methods=['POST'])
def api_vm_start():
    data = request.get_json(force=True, silent=True) or {}
    if not check_auth(data):
        return jsonify({'success': False, 'message': 'bad token'}), 403
    vid = safe_vm_id(data.get('vm_id'))
    if not vid:
        return jsonify({'success': False, 'message': 'invalid vm_id'}), 400
    ram = int(data.get('ram_mb') or 1024)
    cpu = int(data.get('cpu_cores') or 1)
    sp = int(data.get('ssh_port') or 0)
    vp = int(data.get('serial_port') or 0)
    extra_forwards = data.get('extra_forwards') or []
    nested_kvm = bool(data.get('nested_kvm'))
    pid = vmgr.start_vm(vid, ram, cpu, sp, vp, extra_forwards, nested_kvm)
    if pid:
        return jsonify({'success': True, 'pid': pid})
    return jsonify({'success': False, 'message': vmgr.last_start_error or 'failed to start'})


@app.route('/api/vm/stop', methods=['POST'])
def api_vm_stop():
    data = request.get_json(force=True, silent=True) or {}
    if not check_auth(data):
        return jsonify({'success': False, 'message': 'bad token'}), 403
    vid = safe_vm_id(data.get('vm_id'))
    if not vid:
        return jsonify({'success': False, 'message': 'invalid vm_id'}), 400
    ok = vmgr.stop_vm(vid)
    return jsonify({'success': ok})


@app.route('/api/vm/delete', methods=['POST'])
def api_vm_delete():
    data = request.get_json(force=True, silent=True) or {}
    if not check_auth(data):
        return jsonify({'success': False, 'message': 'bad token'}), 403
    vid = safe_vm_id(data.get('vm_id'))
    if not vid:
        return jsonify({'success': False, 'message': 'invalid vm_id'}), 400
    vmgr.destroy_vm(vid)
    return jsonify({'success': True})


@app.route('/api/vm/status', methods=['POST'])
def api_vm_status():
    data = request.get_json(force=True, silent=True) or {}
    if not check_auth(data):
        return jsonify({'success': False, 'message': 'bad token'}), 403
    vid = safe_vm_id(data.get('vm_id'))
    if not vid:
        return jsonify({'success': False, 'message': 'invalid vm_id'}), 400
    running, pid = vmgr.vm_status(vid)
    return jsonify({'success': True, 'running': running, 'pid': pid})


@app.route('/api/vm/metrics', methods=['POST'])
def api_vm_metrics():
    data = request.get_json(force=True, silent=True) or {}
    if not check_auth(data):
        return jsonify({'success': False, 'message': 'bad token'}), 403
    vid = safe_vm_id(data.get('vm_id'))
    if not vid:
        return jsonify({'success': False, 'message': 'invalid vm_id'}), 400
    running, pid = vmgr.vm_status(vid)
    m = vmgr.vm_metrics(pid) if running else None
    return jsonify({'success': True, 'running': running, 'metrics': m})


def main():
    if not REGISTER_TOKEN:
        print("Set PHvm_NODE_TOKEN to the panel's node_register_token (Settings -> Nodes).")
        sys.exit(1)
    print(f"PHvm Node Agent {AGENT_VERSION}")
    print(f"  Panel: {PANEL_URL}")
    print(f"  Name:  {NODE_NAME}")
    print(f"  KVM:   {has_kvm()}")
    try:
        register()
    except Exception as e:
        print(f"Register failed: {e}")
        sys.exit(1)
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    print(f"Agent API on {AGENT_HOST}:{AGENT_PORT}")
    app.run(host=AGENT_HOST, port=AGENT_PORT, debug=False, threaded=True)


if __name__ == '__main__':
    main()
