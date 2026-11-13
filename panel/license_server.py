#!/usr/bin/env python3
"""
PHvm License/Tracking Server
=============================
Run this on ANY server you control (can be the same box as a panel, or a
separate small VPS). Every PHvm Panel install checks in here periodically,
so you can see how many installs exist and blacklist any of them remotely.

Setup:
  pip install flask
  python3 license_server.py

Then in each PHvm Panel's Settings (or directly via env var before first
run), point it at this server:
  PHvm_CHECKIN_URL=http://your-tracking-server:6060/api/checkin
  PHvm_REVOCATION_URL=http://your-tracking-server:6060/api/revocation-list

Default admin login: admin / change-me-now  (CHANGE THIS — see ADMIN_PASSWORD below)
Dashboard: http://your-tracking-server:6060/
"""
import sqlite3
import secrets
import os
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify, render_template_string, session, redirect, url_for

APP_PORT = int(os.environ.get('PHvm_TRACKER_PORT', '6060'))
ADMIN_USER = os.environ.get('PHvm_TRACKER_USER', 'admin')
ADMIN_PASSWORD = os.environ.get('PHvm_TRACKER_PASSWORD', 'change-me-now')
DB_PATH = os.environ.get('PHvm_TRACKER_DB', 'tracker.db')

app = Flask(__name__)
app.secret_key = os.environ.get('PHvm_TRACKER_SECRET') or secrets.token_hex(32)


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = db()
    conn.execute("""CREATE TABLE IF NOT EXISTS installs (
        install_id TEXT PRIMARY KEY,
        hostname TEXT,
        version TEXT,
        ip TEXT,
        first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checkin_count INTEGER DEFAULT 1,
        blacklisted INTEGER DEFAULT 0,
        note TEXT
    )""")
    conn.commit()
    conn.close()


def login_required(f):
    @wraps(f)
    def wrapper(*a, **kw):
        if not session.get('authed'):
            return redirect(url_for('login'))
        return f(*a, **kw)
    return wrapper


# ─────────────────────────── API (called by each panel install) ───────────────────────────

@app.route('/api/checkin', methods=['POST'])
def api_checkin():
    data = request.get_json(force=True, silent=True) or {}
    iid = (data.get('install_id') or '').strip()
    if not iid:
        return jsonify({'success': False, 'message': 'install_id required'}), 400
    hostname = (data.get('hostname') or '')[:120]
    version = (data.get('version') or '')[:40]
    ip = request.headers.get('X-Forwarded-For', request.remote_addr) or ''

    conn = db()
    row = conn.execute("SELECT * FROM installs WHERE install_id=?", (iid,)).fetchone()
    if row:
        conn.execute(
            "UPDATE installs SET hostname=?, version=?, ip=?, last_seen=CURRENT_TIMESTAMP, "
            "checkin_count=checkin_count+1 WHERE install_id=?",
            (hostname, version, ip, iid)
        )
        blacklisted = bool(row['blacklisted'])
    else:
        conn.execute(
            "INSERT INTO installs (install_id, hostname, version, ip) VALUES (?,?,?,?)",
            (iid, hostname, version, ip)
        )
        blacklisted = False
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'blacklisted': blacklisted})


@app.route('/api/revocation-list')
def api_revocation_list():
    """Matches the format PHvm Panel's check_license_revocation() expects."""
    conn = db()
    rows = conn.execute("SELECT install_id FROM installs WHERE blacklisted=1").fetchall()
    conn.close()
    return jsonify({'revoked_install_ids': [r['install_id'] for r in rows], 'revoked_keys': []})


# ─────────────────────────── Admin dashboard ───────────────────────────

LOGIN_HTML = """
<!DOCTYPE html><html><head><title>PHvm Tracker — Login</title>
<style>body{font-family:system-ui;background:#0a0a0c;color:#ececee;display:flex;
align-items:center;justify-content:center;height:100vh;margin:0;}
.box{background:#151517;padding:32px;border-radius:12px;border:1px solid #262629;width:320px;}
input{width:100%;padding:10px;margin:8px 0;background:#101012;border:1px solid #262629;
border-radius:6px;color:#ececee;box-sizing:border-box;}
button{width:100%;padding:10px;background:#4f8ef7;border:none;border-radius:6px;color:#fff;
font-weight:600;cursor:pointer;margin-top:8px;}
.err{color:#e05252;font-size:13px;}
</style></head><body><div class="box">
<h2>PHvm Tracker</h2>
{% if error %}<p class="err">{{ error }}</p>{% endif %}
<form method="POST">
<input name="username" placeholder="Username" autofocus>
<input name="password" type="password" placeholder="Password">
<button type="submit">Login</button>
</form></div></body></html>
"""

DASHBOARD_HTML = """
<!DOCTYPE html><html><head><title>PHvm Tracker</title>
<style>
body{font-family:system-ui;background:#0a0a0c;color:#ececee;margin:0;padding:24px;}
h1{font-size:20px;} table{width:100%;border-collapse:collapse;margin-top:16px;}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #262629;font-size:13px;}
th{color:#9a9aa2;font-weight:600;text-transform:uppercase;font-size:11px;}
.badge{padding:3px 8px;border-radius:5px;font-size:11px;font-weight:600;}
.ok{background:rgba(34,197,94,0.15);color:#4ade80;}
.bad{background:rgba(239,68,68,0.15);color:#f87171;}
button{padding:6px 12px;border-radius:6px;border:none;cursor:pointer;font-size:12px;font-weight:600;}
.btn-block{background:#e05252;color:#fff;} .btn-unblock{background:#3a3a3f;color:#ececee;}
.stat{display:inline-block;background:#151517;border:1px solid #262629;border-radius:10px;
padding:14px 20px;margin-right:12px;}
.stat b{font-size:22px;display:block;}
a.logout{float:right;color:#9a9aa2;font-size:13px;}
code{background:#151517;padding:2px 6px;border-radius:4px;font-size:12px;}
</style></head><body>
<a class="logout" href="{{ url_for('logout') }}">Logout</a>
<h1>🛰️ PHvm Panel Tracker</h1>
<div class="stat"><b>{{ installs|length }}</b>Total installs</div>
<div class="stat"><b>{{ active_count }}</b>Active (7 days)</div>
<div class="stat"><b>{{ blocked_count }}</b>Blacklisted</div>
<table>
<tr><th>Install ID</th><th>Hostname</th><th>Version</th><th>IP</th><th>First Seen</th><th>Last Seen</th><th>Check-ins</th><th>Status</th><th></th></tr>
{% for i in installs %}
<tr>
<td><code>{{ i.install_id }}</code></td>
<td>{{ i.hostname or '—' }}</td>
<td>{{ i.version or '—' }}</td>
<td>{{ i.ip or '—' }}</td>
<td>{{ i.first_seen }}</td>
<td>{{ i.last_seen }}</td>
<td>{{ i.checkin_count }}</td>
<td>{% if i.blacklisted %}<span class="badge bad">BLACKLISTED</span>{% else %}<span class="badge ok">Active</span>{% endif %}</td>
<td>
<form method="POST" action="{{ url_for('toggle_blacklist', install_id=i.install_id) }}" style="display:inline;">
{% if i.blacklisted %}
<button class="btn-unblock" type="submit">Unblock</button>
{% else %}
<button class="btn-block" type="submit" onclick="return confirm('Blacklist this install? It will disable itself next check (up to 6h).')">Blacklist</button>
{% endif %}
</form>
</td>
</tr>
{% else %}
<tr><td colspan="9" style="text-align:center;color:#68686f;padding:32px;">No check-ins yet. Point a panel's PHvm_CHECKIN_URL here.</td></tr>
{% endfor %}
</table>
</body></html>
"""


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        if request.form.get('username') == ADMIN_USER and request.form.get('password') == ADMIN_PASSWORD:
            session['authed'] = True
            return redirect(url_for('dashboard'))
        return render_template_string(LOGIN_HTML, error='Invalid login.')
    return render_template_string(LOGIN_HTML, error=None)


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route('/')
@login_required
def dashboard():
    conn = db()
    installs = conn.execute("SELECT * FROM installs ORDER BY last_seen DESC").fetchall()
    conn.close()
    active_count = sum(1 for i in installs if (datetime.now() - datetime.strptime(i['last_seen'][:19], '%Y-%m-%d %H:%M:%S')).days < 7)
    blocked_count = sum(1 for i in installs if i['blacklisted'])
    return render_template_string(DASHBOARD_HTML, installs=installs, active_count=active_count, blocked_count=blocked_count)


@app.route('/toggle/<install_id>', methods=['POST'])
@login_required
def toggle_blacklist(install_id):
    conn = db()
    row = conn.execute("SELECT blacklisted FROM installs WHERE install_id=?", (install_id,)).fetchone()
    if row:
        conn.execute("UPDATE installs SET blacklisted=? WHERE install_id=?", (0 if row['blacklisted'] else 1, install_id))
        conn.commit()
    conn.close()
    return redirect(url_for('dashboard'))


if __name__ == '__main__':
    init_db()
    if ADMIN_PASSWORD == 'change-me-now':
        print("⚠️  WARNING: using the default password! Set PHvm_TRACKER_PASSWORD before exposing this publicly.")
    print(f"PHvm Tracker running on http://0.0.0.0:{APP_PORT}  (login: {ADMIN_USER} / {'*' * len(ADMIN_PASSWORD)})")
    app.run(host='0.0.0.0', port=APP_PORT, debug=False)
