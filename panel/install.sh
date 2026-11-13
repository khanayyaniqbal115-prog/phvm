#!/usr/bin/env bash
#
# PHvm Panel — One-Command Installer
# Usage:
#   sudo bash install.sh
#   or:  curl -fsSL https://YOUR_HOST/install.sh | sudo bash
#
set -euo pipefail

# ---------- interactive input (also works for: curl ... | sudo bash) ----------
# When the script itself is piped into bash, stdin is the script, so questions
# must be read from the terminal (/dev/tty) instead.
HAVE_TTY=0
PROMPT_IN=/dev/stdin
if [[ -t 0 ]]; then
  HAVE_TTY=1
elif ( : < /dev/tty ) 2>/dev/null; then
  HAVE_TTY=1
  PROMPT_IN=/dev/tty
fi
read() { builtin read "$@" < "$PROMPT_IN"; }

# ---------- colors ----------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BLUE='\033[0;34m'; MAGENTA='\033[0;35m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'
info()  { echo -e "${CYAN}[PHvm]${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
err()   { echo -e "${RED}✗${NC} $1"; }
CUR_STEP=0
TOTAL_STEPS=6
step()  { CUR_STEP=$((CUR_STEP+1)); echo ""; echo -e "${MAGENTA}▸${NC} ${BOLD}[${CUR_STEP}/${TOTAL_STEPS}] $1${NC}"; }

# ---------- change admin e-mail + password (menu option 5, or: sudo bash install.sh reset-admin) ----------
# Updates the existing admin IN PLACE (the account, its servers and settings are kept), fixes a forgotten /
# default password, switches off 2-factor so you can get in, clears any login lock and restarts the panel.
admin_reset_flow() {
  local _dir="${PHVM_INSTALL_DIR:-/opt/phvm}"
  if [[ ! -f "${_dir}/phvm.py" || ! -f "${_dir}/phvm.db" ]]; then
    err "No existing install with a database found at ${_dir}. Install first (or set PHVM_INSTALL_DIR)."
    return 1
  fi
  local _py="${_dir}/venv/bin/python"; [[ -x "$_py" ]] || _py="python3"
  echo ""
  echo -e "${CYAN}=== PHvm — Change admin e-mail and password ===${NC}"
  echo -e "${DIM}Existing admin accounts:${NC}"
  (cd "$_dir" && "$_py" - <<'PYEOF'
import sqlite3
c = sqlite3.connect("phvm.db")
for u, e in c.execute("SELECT username, email FROM users WHERE role='admin' ORDER BY id"):
    print(f"   - {u}  <{e}>")
PYEOF
  ) || true
  local _def; _def=$(cd "$_dir" && "$_py" -c "import sqlite3;r=sqlite3.connect('phvm.db').execute(\"SELECT username FROM users WHERE role='admin' ORDER BY id LIMIT 1\").fetchone();print(r[0] if r else 'phvm')" 2>/dev/null || echo phvm)
  local NEW_USER NEW_EMAIL NEW_PASS NEW_PASS2
  read -rp "Admin username to change [${_def}]: " NEW_USER
  NEW_USER="${NEW_USER:-$_def}"
  if ! [[ "$NEW_USER" =~ ^[A-Za-z0-9_.-]{3,32}$ ]]; then err "Username: 3-32 characters, letters/numbers/._- only."; return 1; fi
  while true; do
    read -rp "New e-mail address: " NEW_EMAIL
    [[ "$NEW_EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] && break
    warn "That does not look like an e-mail address."
  done
  while true; do
    read -rsp "New password (min 6 characters): " NEW_PASS; echo ""
    if [[ ${#NEW_PASS} -lt 6 || "$NEW_PASS" =~ [[:space:]\'\"\\%\$\`] ]]; then
      warn "Use at least 6 characters, without spaces or the characters  ' \" \\ % \$ \`"; continue
    fi
    read -rsp "Repeat the password: " NEW_PASS2; echo ""
    [[ "$NEW_PASS" == "$NEW_PASS2" ]] && break
    warn "Passwords did not match."
  done

  info "Stopping the panel (safe database write)..."
  systemctl stop "${SERVICE_NAME:-phvm}" 2>/dev/null || true
  local _rc=0
  (cd "$_dir" && "$_py" - "$NEW_USER" "$NEW_EMAIL" "$NEW_PASS" <<'PYEOF'
import sqlite3, sys
from werkzeug.security import generate_password_hash
user, email, pw = sys.argv[1], sys.argv[2], sys.argv[3]
c = sqlite3.connect("phvm.db")
h = generate_password_hash(pw, method="scrypt")
other = c.execute("SELECT username FROM users WHERE email=? AND username<>?", (email, user)).fetchone()
if other:
    print(f"That e-mail is already used by '{other[0]}'. Pick another one."); sys.exit(2)
row = c.execute("SELECT id FROM users WHERE username=?", (user,)).fetchone()
if row:
    c.execute("UPDATE users SET email=?, password=?, role='admin', is_active=1 WHERE id=?", (email, h, row[0]))
    for col, val in (("must_change_password", 0), ("totp_enabled", 0)):
        try: c.execute(f"UPDATE users SET {col}=? WHERE id=?", (val, row[0]))
        except Exception: pass
    print(f"Admin '{user}' updated (e-mail + password). Servers and settings were kept.")
else:
    c.execute("INSERT INTO users (username, email, password, role) VALUES (?,?,?,'admin')", (user, email, h))
    print(f"New admin '{user}' created.")
c.commit()
PYEOF
  ) || _rc=$?
  if [[ $_rc -ne 0 ]]; then
    systemctl start "${SERVICE_NAME:-phvm}" 2>/dev/null || true
    err "Nothing was changed."; return 1
  fi
  # keep the start-up env file and the old password note in step, so nothing stale confuses you later
  rm -f "${_dir}/ADMIN_PASSWORD.txt"
  if [[ -f /etc/phvm.env ]]; then
    sed -i -e "s|^PHVM_ADMIN_USER=.*|PHVM_ADMIN_USER='${NEW_USER}'|" -e "s|^PHVM_ADMIN_PASSWORD=.*|PHVM_ADMIN_PASSWORD='${NEW_PASS}'|" /etc/phvm.env
    grep -q '^PHVM_ADMIN_EMAIL=' /etc/phvm.env && sed -i "s|^PHVM_ADMIN_EMAIL=.*|PHVM_ADMIN_EMAIL='${NEW_EMAIL}'|" /etc/phvm.env || echo "PHVM_ADMIN_EMAIL='${NEW_EMAIL}'" >> /etc/phvm.env
  fi
  info "Starting the panel..."
  systemctl start "${SERVICE_NAME:-phvm}" 2>/dev/null || true
  echo ""
  ok "Done. Log in with  ${NEW_USER}  and the new password. (2-factor was switched off for this account; turn it on again in Profile.)"
  return 0
}
if [[ "${1:-}" == "create-admin" || "${1:-}" == "reset-admin" ]]; then
  admin_reset_flow; exit $?
fi

# Small spinner for quiet/long-running background steps.
spinner() {
  local pid=$1 msg=$2 frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏' i=0
  while kill -0 "$pid" 2>/dev/null; do
    i=$(( (i+1) % ${#frames} ))
    printf "\r${CYAN}%s${NC} %s" "${frames:$i:1}" "$msg"
    sleep 0.1
  done
  wait "$pid" 2>/dev/null
  local status=$?
  if [[ $status -eq 0 ]]; then
    printf "\r${GREEN}✓${NC} %s\n" "$msg"
  else
    printf "\r${RED}✗${NC} %s (see log above)\n" "$msg"
  fi
  return $status
}

clear 2>/dev/null || true
echo ""
echo -e "${CYAN}${BOLD}"
cat << 'BANNER'
    ██████╗ ██╗  ██╗██╗   ██╗███╗   ███╗
    ██╔══██╗██║  ██║██║   ██║████╗ ████║
    ██████╔╝███████║██║   ██║██╔████╔██║
    ██╔═══╝ ██╔══██║╚██╗ ██╔╝██║╚██╔╝██║
    ██║     ██║  ██║ ╚████╔╝ ██║ ╚═╝ ██║
    ╚═╝     ╚═╝  ╚═╝  ╚═══╝  ╚═╝     ╚═╝
BANNER
echo -e "${NC}${DIM}          KVM Virtualization Panel — Installer${NC}"
echo ""

# ---------- must be root ----------
if [[ "${EUID}" -ne 0 ]]; then
  err "Please run as root (sudo bash install.sh)"
  exit 1
fi

# ---------- config ----------
INSTALL_DIR="${PHVM_INSTALL_DIR:-/opt/phvm}"
REPO_URL="${PHVM_REPO_URL:-https://github.com/Phvmpanel/v1.git}"
SERVICE_NAME="phvm"
PANEL_PORT="${PHVM_PORT:-5050}"
# Admin login: asked during install (or set PHVM_ADMIN_USER / PHVM_ADMIN_PASSWORD). Default: phvm / phvm123
ADMIN_USER="${PHVM_ADMIN_USER:-}"
ADMIN_PW="${PHVM_ADMIN_PASSWORD:-}"
ADMIN_EMAIL="${PHVM_ADMIN_EMAIL:-}"
SERVER_IPV4="${PHVM_SERVER_IP:-}"
WEB_MODE="${PHVM_WEB_MODE:-}"
TUNNEL_TOKEN="${PHVM_TUNNEL_TOKEN:-}"
CF_API_TOKEN="${PHVM_CF_API_TOKEN:-}"
PANEL_TUNNEL_HOST=""
if ! [[ "$PANEL_PORT" =~ ^[0-9]+$ ]] || (( PANEL_PORT < 1 || PANEL_PORT > 65535 )); then
  err "PHVM_PORT must be a number between 1 and 65535 (got '${PANEL_PORT}')"
  exit 1
fi
SERVERS_DIR="${PHVM_SERVERS_DIR:-/srv/phvm-servers}"
PY_BIN="python3"
DOMAIN="${PHVM_DOMAIN:-}"

# ---------- interactive menu ----------
# PHVM_ACTION=install|update|uninstall|reinstall can be set to skip the
# prompt (e.g. for curl|bash automation): PHVM_ACTION=update bash install.sh
if [[ "$HAVE_TTY" -eq 1 && -z "${PHVM_ACTION:-}" ]]; then
  echo -e "${BOLD}What would you like to do?${NC}"
  echo "  1) Install PHvm Panel"
  echo "  2) Update PHvm Panel (pull latest source + restart)"
  echo "  3) Uninstall PHvm Panel"
  echo "  4) Reinstall (wipe + fresh install)"
  echo "  5) Change admin e-mail & password"
  echo "  6) Exit"
  echo ""
  read -rp "Choose an option [1-6, default 1]: " MENU_CHOICE
  MENU_CHOICE="${MENU_CHOICE:-1}"
else
  MENU_CHOICE="${PHVM_ACTION:-1}"
fi

case "$MENU_CHOICE" in
  2|update|Update) ACTION="update" ;;
  3|uninstall|Uninstall) ACTION="uninstall" ;;
  4|reinstall|Reinstall) ACTION="reinstall" ;;
  5|reset-admin|admin) admin_reset_flow; exit $? ;;
  6|exit|Exit) echo "Bye!"; exit 0 ;;
  *) ACTION="install" ;;
esac

if [[ "$ACTION" == "uninstall" || "$ACTION" == "reinstall" ]]; then
  echo ""
  warn "This will stop the PHvm service running at ${INSTALL_DIR}."
  read -rp "Are you sure you want to continue? [y/N]: " confirm_uninstall
  if [[ ! "$confirm_uninstall" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
  fi
  info "Stopping service..."
  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  systemctl disable "$SERVICE_NAME" 2>/dev/null || true
  rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
  pkill -f "${INSTALL_DIR}/venv/bin/python ${INSTALL_DIR}/phvm.py" 2>/dev/null || true
  pkill -f "phvm-watchdog" 2>/dev/null || true
  systemctl daemon-reload 2>/dev/null || true

  if [[ "$ACTION" == "uninstall" ]]; then
    read -rp "Also delete VM data and the database at ${INSTALL_DIR}? [y/N]: " wipe_data
    if [[ "$wipe_data" =~ ^[Yy]$ ]]; then
      rm -rf "$INSTALL_DIR"
      ok "Removed ${INSTALL_DIR} completely."
    else
      ok "Service stopped and disabled. Files kept at ${INSTALL_DIR}."
    fi
    echo ""
    echo -e "${GREEN}${BOLD}Uninstall complete.${NC}"
    exit 0
  fi

  ok "Existing installation stopped — proceeding with a fresh install."
  rm -rf "$INSTALL_DIR"
  # falls through into the normal install flow below
fi

if [[ "$ACTION" == "update" ]]; then
  if [[ ! -d "$INSTALL_DIR" ]]; then
    err "No existing installation found at ${INSTALL_DIR}. Choose 'Install' instead."
    exit 1
  fi
  step "Updating PHvm Panel"
  TOTAL_STEPS=1
  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  pkill -f "${INSTALL_DIR}/venv/bin/python ${INSTALL_DIR}/phvm.py" 2>/dev/null || true
  cd "$INSTALL_DIR"
  # Detect if we're updating from a freshly-extracted local copy (the normal
  # case here — there's no public git repo backing this install, so the old
  # git-pull / git-clone-from-REPO_URL fallback below just failed for
  # everyone: REPO_URL never pointed at real, up-to-date source. If you're
  # running this script from inside a newly extracted zip, use THAT as the
  # update source instead of reaching out to git at all.
  _update_src=""
  if [[ -n "${BASH_SOURCE:-}" ]]; then
    _src_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
    if [[ -n "$_src_dir" && -f "$_src_dir/phvm.py" && "$_src_dir" != "$INSTALL_DIR" ]]; then
      _update_src="$_src_dir"
    fi
  fi
  if [[ -n "$_update_src" ]]; then
    info "Updating from local files (${_update_src})..."
    ( rsync -a --exclude 'phvm.db' --exclude 'phvm.db-*' --exclude '.secret_key' \
             --exclude 'vm_instances' --exclude 'backups' --exclude 'venv' \
             "$_update_src"/ "$INSTALL_DIR"/ ) > /tmp/phvm-update.log 2>&1 &
    spinner $! "Copying updated files..." || { err "Update copy failed — log:"; tail -n 30 /tmp/phvm-update.log; exit 1; }
  elif [[ -d .git ]]; then
    ( git pull --ff-only ) > /tmp/phvm-update.log 2>&1 &
    spinner $! "Pulling latest source (git)..." || { err "git pull failed — log:"; tail -n 30 /tmp/phvm-update.log; exit 1; }
  else
    err "No local source found next to this script, and this isn't a git checkout."
    err "Download/extract the latest PHvm zip, then run install.sh from inside that folder and choose Update again."
    exit 1
  fi
  if [[ -f venv/bin/activate ]]; then
    ( source venv/bin/activate && pip install -r requirements.txt --quiet ) > /tmp/phvm-update-pip.log 2>&1 &
    spinner $! "Updating Python packages..." || warn "pip install had issues — check /tmp/phvm-update-pip.log"
  fi
  if systemctl list-unit-files "${SERVICE_NAME}.service" >/dev/null 2>&1; then
    systemctl start "$SERVICE_NAME" 2>/dev/null || true
  else
    ( cd "$INSTALL_DIR" && bash restart.sh ) 2>/dev/null || true
  fi
  ok "Update complete — service restarted."
  exit 0
fi

# Detect if we're running from a local checkout (e.g. `bash install.sh` inside
# the extracted folder) vs piped via `curl | bash` (no local files exist).
LOCAL_SRC=""
if [[ -n "${BASH_SOURCE:-}" ]]; then
  _src_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
  if [[ -n "$_src_dir" && -f "$_src_dir/phvm.py" ]]; then
    LOCAL_SRC="$_src_dir"
  fi
fi

echo ""

# ---------- detect OS ----------
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  OS_ID="${ID:-unknown}"
else
  OS_ID="unknown"
fi

if [[ "$OS_ID" != "ubuntu" && "$OS_ID" != "debian" ]]; then
  warn "This installer is built for Ubuntu/Debian. Detected: $OS_ID"
  read -rp "Continue anyway? [y/N]: " cont
  [[ "$cont" =~ ^[Yy]$ ]] || exit 1
fi

# ---------- virtualization check ----------
# PHvm creates real KVM virtual machines, which generally cannot run inside
# an LXC/OpenVZ container — only on a real KVM/full-virtualization VPS or
# bare metal. Many cheap "VPS" providers actually sell LXC containers.
info "Checking what kind of server this is..."
VIRT_TYPE=$(systemd-detect-virt 2>/dev/null || echo "none")
if [[ "$VIRT_TYPE" == "lxc" || "$VIRT_TYPE" == "openvz" ]]; then
  echo ""
  warn "This server is itself an LXC/OpenVZ container (detected: ${VIRT_TYPE})."
  warn "PHvm creates KVM virtual machines, which generally CANNOT run nested inside"
  warn "an LXC/OpenVZ container. If your provider sold this as a 'container VPS',"
  warn "VM creation will likely fail even if this installer completes successfully."
  echo ""
  read -rp "Continue installing anyway? [y/N]: " cont_virt
  [[ "$cont_virt" =~ ^[Yy]$ ]] || { err "Installation cancelled."; exit 1; }
elif [[ "$VIRT_TYPE" == "kvm" || "$VIRT_TYPE" == "none" ]]; then
  ok "This looks like a real VPS/bare metal (detected: ${VIRT_TYPE}) — nested KVM should work."
else
  warn "Could not clearly determine server type (detected: ${VIRT_TYPE}). Proceeding, but VM creation may fail if this is a container-based VPS."
fi
echo ""

# ---------- platform detection (Railway, and similar managed PaaS) ----------
# On Railway (and most managed container platforms), you don't run your own
# nginx/certbot — the platform's own edge network terminates TLS and proxies
# to your container. Trying to bind port 80/443 yourself there is pointless
# (traffic never reaches it that way) and privileged operations are blocked
# anyway. Detect it and skip straight past the nginx/SSL section.
ON_RAILWAY=0
if [[ -n "${RAILWAY_ENVIRONMENT:-}" || -n "${RAILWAY_PROJECT_ID:-}" || -n "${RAILWAY_SERVICE_ID:-}" ]]; then
  ON_RAILWAY=1
fi

# ---------- setup questions ----------
# Asked only on a real terminal. Every answer can also be given up front with
# environment variables (PHVM_WEB_MODE, PHVM_DOMAIN, PHVM_SERVER_IP, PHVM_ADMIN_USER,
# PHVM_ADMIN_PASSWORD, PHVM_TUNNEL_TOKEN) for unattended installs.
ask_valid_ipv4() { [[ "$1" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] && ! [[ "$1" =~ (^|\.)(25[6-9]|2[6-9][0-9]|[3-9][0-9][0-9])(\.|$) ]]; }
ask_valid_domain() { [[ "$1" =~ ^([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$ ]]; }

if [[ "$ON_RAILWAY" -eq 1 ]]; then
  if [[ -n "$DOMAIN" ]]; then
    warn "Domain '${DOMAIN}' given, but this looks like Railway — skipping nginx/certbot."
    warn "On Railway, set the domain from the dashboard instead: Service -> Settings ->"
    warn "Networking -> Custom Domain (Railway issues the SSL cert automatically)."
  fi
  DOMAIN=""
elif [[ "$HAVE_TTY" -eq 1 ]]; then
  echo -e "${BOLD}Setup${NC}  ${DIM}(press Enter to accept the value in [brackets])${NC}"
  echo ""
  # 1) how will people reach this server?
  if [[ -z "$WEB_MODE" ]]; then
    echo "  How is this server reached from the internet?"
    echo "    1) It has a public IPv4 address (normal VPS)"
    echo "    2) No public IPv4 / behind NAT  ->  use a Cloudflare Tunnel"
    read -rp "  Choose [1-2, default 1]: " _m
    case "${_m:-1}" in 2|tunnel) WEB_MODE="tunnel" ;; *) WEB_MODE="direct" ;; esac
  fi
  [[ "$WEB_MODE" == "tunnel" ]] || WEB_MODE="direct"

  if [[ "$WEB_MODE" == "tunnel" ]]; then
    echo ""
    echo -e "  ${DIM}Create a tunnel at https://one.dash.cloudflare.com -> Networks -> Tunnels -> Create a tunnel (Cloudflared),${NC}"
    echo -e "  ${DIM}then paste the token (or the whole 'cloudflared service install ...' command) here.${NC}"
    while [[ -z "$TUNNEL_TOKEN" ]]; do
      read -rp "  Cloudflare Tunnel token (blank to skip and set it up later): " _t
      [[ -z "$_t" ]] && break
      _t="${_t##* }"
      if [[ "$_t" =~ ^[A-Za-z0-9_=+/.-]{40,}$ ]]; then TUNNEL_TOKEN="$_t"; else warn "That doesn't look like a tunnel token — try again."; fi
    done
    if [[ -n "$TUNNEL_TOKEN" && -z "$CF_API_TOKEN" ]]; then
      echo -e "  ${DIM}Optional: a Cloudflare API token (Account: Cloudflare Tunnel Edit + Zone: DNS Edit) lets the panel add${NC}"
      echo -e "  ${DIM}each website to the tunnel and DNS automatically. Blank = you add public hostnames by hand.${NC}"
      while true; do
        read -rsp "  Cloudflare API token (blank to skip): " CF_API_TOKEN; echo ""
        [[ -z "$CF_API_TOKEN" || "$CF_API_TOKEN" =~ ^[A-Za-z0-9_-]{30,}$ ]] && break
        warn "That does not look like an API token — try again."
      done
    fi
    if [[ -z "$DOMAIN" ]]; then
      read -rp "  Domain for the PANEL, e.g. panel.example.com (blank to skip): " DOMAIN
    fi
    while [[ -n "$DOMAIN" ]] && ! ask_valid_domain "$DOMAIN"; do
      warn "Enter a domain like panel.example.com (no http://)."
      read -rp "  Domain for the PANEL (blank to skip): " DOMAIN
    done
    PANEL_TUNNEL_HOST="$DOMAIN"
    DOMAIN=""      # no nginx/certbot in tunnel mode — Cloudflare provides HTTPS
  else
    # 2) domain
    if [[ -z "$DOMAIN" ]]; then
      read -rp "  Domain for the panel, e.g. panel.example.com (blank to skip, use IP:${PANEL_PORT}): " DOMAIN
    fi
    while [[ -n "$DOMAIN" ]] && ! ask_valid_domain "$DOMAIN"; do
      warn "Enter a domain like panel.example.com (no http://)."
      read -rp "  Domain for the panel (blank to skip): " DOMAIN
    done
    # 3) IPv4
    if [[ -z "$SERVER_IPV4" ]]; then
      _det="$(curl -s -4 --max-time 6 ifconfig.me 2>/dev/null || true)"
      ask_valid_ipv4 "$_det" || _det=""
      read -rp "  Public IPv4 address of this server${_det:+ [${_det}]}: " SERVER_IPV4
      SERVER_IPV4="${SERVER_IPV4:-$_det}"
    fi
    while [[ -n "$SERVER_IPV4" ]] && ! ask_valid_ipv4 "$SERVER_IPV4"; do
      warn "That is not a valid IPv4 address (example: 203.0.113.10)."
      read -rp "  Public IPv4 address of this server: " SERVER_IPV4
    done
    # optional: let websites use a Cloudflare Tunnel as well (chosen per domain in the panel)
    while [[ -z "$TUNNEL_TOKEN" ]]; do
      read -rp "  Optional - Cloudflare Tunnel token so websites can also use a tunnel (blank to skip): " _t
      [[ -z "$_t" ]] && break
      _t="${_t##* }"
      if [[ "$_t" =~ ^[A-Za-z0-9_=+/.-]{40,}$ ]]; then TUNNEL_TOKEN="$_t"; else warn "That doesn't look like a tunnel token - try again."; fi
    done
    if [[ -n "$TUNNEL_TOKEN" && -z "$CF_API_TOKEN" ]]; then
      while true; do
        read -rsp "  Cloudflare API token for automatic setup (blank to skip): " CF_API_TOKEN; echo ""
        [[ -z "$CF_API_TOKEN" || "$CF_API_TOKEN" =~ ^[A-Za-z0-9_-]{30,}$ ]] && break
        warn "That does not look like an API token - try again."
      done
    fi
  fi

  # 4) admin account
  echo ""
  if [[ -z "$ADMIN_USER" ]]; then
    read -rp "  Admin username [phvm]: " ADMIN_USER
  fi
  ADMIN_USER="${ADMIN_USER:-phvm}"
  while ! [[ "$ADMIN_USER" =~ ^[A-Za-z0-9_.-]{3,32}$ ]]; do
    warn "Username: 3-32 characters, letters/numbers/._- only."
    read -rp "  Admin username [phvm]: " ADMIN_USER; ADMIN_USER="${ADMIN_USER:-phvm}"
  done
  if [[ -z "$ADMIN_EMAIL" ]]; then
    read -rp "  Admin e-mail (for password reset mails) [${ADMIN_USER}@phvm.local]: " ADMIN_EMAIL
  fi
  if [[ -z "$ADMIN_PW" ]]; then
    while true; do
      read -rsp "  Admin password (blank = phvm123, change it right after login): " ADMIN_PW; echo ""
      [[ -z "$ADMIN_PW" ]] && break
      if [[ ${#ADMIN_PW} -lt 6 || "$ADMIN_PW" =~ [[:space:]\'\"\\%\$\`] ]]; then
        warn "Use at least 6 characters, without spaces or the characters  ' \" \\ % \$ \`"
        ADMIN_PW=""; continue
      fi
      read -rsp "  Repeat the password: " _pw2; echo ""
      [[ "$_pw2" == "$ADMIN_PW" ]] && break
      warn "Passwords did not match."; ADMIN_PW=""
    done
  fi
  echo ""
fi
ADMIN_USER="${ADMIN_USER:-phvm}"
if [[ -z "$ADMIN_PW" ]]; then
  ADMIN_PW="phvm123"
  warn "Using the default admin password 'phvm123' — it is public knowledge, change it right after you log in."
fi
if [[ "$ADMIN_PW" =~ [[:space:]\'\"\\%\$\`] ]]; then
  err "PHVM_ADMIN_PASSWORD may not contain spaces or the characters  ' \" \\ % \$ \`"
  exit 1
fi
[[ "$WEB_MODE" == "tunnel" ]] || WEB_MODE="direct"

if [[ -n "$DOMAIN" ]]; then
  TOTAL_STEPS=7
fi

# Settings the panel reads at start-up (systemd EnvironmentFile format: KEY='value').
ENV_FILE="/etc/phvm.env"
umask 077
{
  echo "PHVM_ADMIN_USER='${ADMIN_USER}'"
  echo "PHVM_ADMIN_PASSWORD='${ADMIN_PW}'"
  [[ -n "$ADMIN_EMAIL" ]] && echo "PHVM_ADMIN_EMAIL='${ADMIN_EMAIL}'"
  echo "PHVM_WEB_MODE='${WEB_MODE}'"
  [[ -n "$TUNNEL_TOKEN" ]] && echo "PHVM_TUNNEL_TOKEN='${TUNNEL_TOKEN}'"
  [[ -n "$CF_API_TOKEN" ]] && echo "PHVM_CF_API_TOKEN='${CF_API_TOKEN}'"
  [[ -n "$SERVER_IPV4" ]] && echo "PHVM_SERVER_IP='${SERVER_IPV4}'"
  echo "PHVM_PORT='${PANEL_PORT}'"
  echo "PHVM_SERVERS_DIR='${SERVERS_DIR}'"
} > "$ENV_FILE"
umask 022
chmod 600 "$ENV_FILE"

# ---------- install host dependencies ----------
step "System packages"
apt update -y > /tmp/phvm-apt-update.log 2>&1 &
spinner $! "Updating package lists..." || { err "apt update failed — log:"; tail -n 30 /tmp/phvm-apt-update.log; exit 1; }

# Unhold git from any previous run of this script (older versions held it,
# which can conflict with bundled security-update transactions).
apt-mark unhold git >/dev/null 2>&1 || true
dpkg --configure -a >/dev/null 2>&1 || true

# --no-upgrade: only install what's missing, never upgrade packages that
# are already present. This avoids two container-filesystem issues at once:
#  - "Invalid cross-device link" when dpkg tries to upgrade an in-use binary
#    like git on some overlay filesystems
#  - "Held packages were changed" when apt bundles git/curl/wget together
#    into one upgrade transaction just because sshpass needs installing
apt install -y --no-upgrade \
  qemu-system-x86 qemu-utils cloud-image-utils \
  wget curl sshpass openssh-client git \
  python3 python3-pip python3-venv \
  cpu-checker psmisc net-tools unzip > /tmp/phvm-apt-install.log 2>&1 &
if ! spinner $! "Installing host dependencies (qemu, cloud-image-utils, python, etc)..."; then
    warn "apt install hit an error — attempting to fix broken packages and retry..."
    apt-get install -f -y > /tmp/phvm-apt-fix.log 2>&1 || true
    dpkg --configure -a > /tmp/phvm-apt-fix.log 2>&1 || true
    apt install -y --no-upgrade \
      qemu-system-x86 qemu-utils cloud-image-utils \
      wget curl sshpass openssh-client git \
      python3 python3-pip python3-venv \
      cpu-checker psmisc net-tools unzip > /tmp/phvm-apt-install.log 2>&1 &
    spinner $! "Retrying host dependency install..." || { err "apt install failed — log:"; tail -n 30 /tmp/phvm-apt-install.log; exit 1; }
fi

# (Nginx + Certbot are only installed later, and only if Docker/Caddy cannot serve the panel domain.)

# ---------- Docker (Minecraft / Bot servers run as containers) ----------
DOCKER_STATE="not installed"
if command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    apt install -y --no-upgrade docker.io > /tmp/phvm-apt-docker.log 2>&1 &
    spinner $! "Installing Docker (Minecraft / Bot servers run as containers)..." \
      || warn "Docker install failed (log: /tmp/phvm-apt-docker.log) — Minecraft/Bot plans will use VMs instead."
  fi
  if command -v docker >/dev/null 2>&1; then
    systemctl enable --now docker >/dev/null 2>&1 || true
    mkdir -p "${SERVERS_DIR}"
    if docker info >/dev/null 2>&1; then DOCKER_STATE="running"; else DOCKER_STATE="installed but the daemon is not running"; fi
  fi
else
  warn "No systemd here — skipping Docker. Minecraft/Bot plans will use VMs (mount the host's Docker socket to use containers)."
fi

# ---------- KVM check ----------
step "Virtualization check"
info "Checking for hardware virtualization (KVM)..."
if kvm-ok >/dev/null 2>&1; then
  ok "KVM is available — VMs will run at near-native speed."
else
  warn "KVM not available on this host — VMs will fall back to TCG (slower software emulation)."
  warn "If this is a VPS, ask your provider to enable nested virtualization."
fi

# ---------- get app files (local copy or fresh clone) ----------
if [[ -n "$LOCAL_SRC" && "$LOCAL_SRC" != "$INSTALL_DIR" ]]; then
  step "Application files"
  info "Installing PHvm from local files (${LOCAL_SRC})..."
  mkdir -p "$INSTALL_DIR"
  cp -r "$LOCAL_SRC"/. "$INSTALL_DIR"/
elif [[ -n "$LOCAL_SRC" ]]; then
  info "Already running from ${INSTALL_DIR}"
else
  step "Application files"
  info "Downloading PHvm from ${REPO_URL}..."
  rm -rf "$INSTALL_DIR"
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"

# ---------- python venv + deps ----------
step "Python environment"
info "Creating Python virtual environment..."
$PY_BIN -m venv venv
source venv/bin/activate

pip install --upgrade pip >/dev/null 2>&1
pip install -r requirements.txt > /tmp/phvm-pip.log 2>&1 &
spinner $! "Installing Python packages (Flask, psutil, paramiko, discord.py, ...)" || { err "pip install failed — log:"; tail -n 30 /tmp/phvm-pip.log; exit 1; }

ok "Python environment ready."
deactivate

# ---------- service: systemd if available, otherwise nohup + watchdog ----------
# Docker/LXC containers usually don't run systemd as PID 1, so `systemctl`
# doesn't exist there. Detect that and fall back to a simple background
# process + a watchdog loop that restarts it if it dies (poor man's Restart=on-failure).
HAS_SYSTEMD=0
if command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
  HAS_SYSTEMD=1
fi

if [[ "$HAS_SYSTEMD" -eq 1 ]]; then
  step "Service setup"
  info "Creating systemd service (auto-start on boot)..."
  cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=PHvm Panel
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/venv/bin/python ${INSTALL_DIR}/phvm.py
Restart=on-failure
RestartSec=5
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=${ENV_FILE}

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable ${SERVICE_NAME} >/dev/null 2>&1
  systemctl restart ${SERVICE_NAME}

  sleep 2

  if systemctl is-active --quiet ${SERVICE_NAME}; then
    ok "PHvm Panel service is running."
  else
    err "Service failed to start. Check logs with: journalctl -u ${SERVICE_NAME} -e"
    exit 1
  fi
else
  warn "No systemd here (PID 1 is not systemd — you're likely inside Docker/LXC)."
  step "Service setup"
  info "Starting PHvm Panel with a nohup + auto-restart watchdog instead..."

  mkdir -p "${INSTALL_DIR}/run"
  PIDFILE="${INSTALL_DIR}/run/phvm.pid"
  LOGFILE="${INSTALL_DIR}/run/phvm.log"
  WATCHDOG_PIDFILE="${INSTALL_DIR}/run/watchdog.pid"

  # Kill any previous instance from an earlier install run.
  [[ -f "$PIDFILE" ]] && kill "$(cat "$PIDFILE")" >/dev/null 2>&1 || true
  [[ -f "$WATCHDOG_PIDFILE" ]] && kill "$(cat "$WATCHDOG_PIDFILE")" >/dev/null 2>&1 || true
  pkill -f "${INSTALL_DIR}/venv/bin/python ${INSTALL_DIR}/phvm.py" >/dev/null 2>&1 || true

  cat > "${INSTALL_DIR}/run/watchdog.sh" <<EOF
#!/usr/bin/env bash
# Restarts phvm.py whenever it exits. Runs in the background.
cd "${INSTALL_DIR}"
while true; do
  set -a; . "${ENV_FILE}"; set +a
  PYTHONUNBUFFERED=1 "${INSTALL_DIR}/venv/bin/python" "${INSTALL_DIR}/phvm.py" >> "${LOGFILE}" 2>&1 &
  echo \$! > "${PIDFILE}"
  wait \$!
  echo "[\$(date)] PHvm exited, restarting in 5s..." >> "${LOGFILE}"
  sleep 5
done
EOF
  chmod +x "${INSTALL_DIR}/run/watchdog.sh"

  nohup "${INSTALL_DIR}/run/watchdog.sh" >/dev/null 2>&1 &
  disown
  echo $! > "$WATCHDOG_PIDFILE"

  sleep 3

  if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" >/dev/null 2>&1; then
    ok "PHvm Panel is running (PID $(cat "$PIDFILE"), watchdog PID $(cat "$WATCHDOG_PIDFILE"))."
    info "Logs: tail -f ${LOGFILE}"
    warn "This container has no init system, so PHvm won't survive a container restart on its own."
    warn "Re-run this installer (or just: bash ${INSTALL_DIR}/run/watchdog.sh &) after the container restarts,"
    warn "or better: run this container with a proper entrypoint / --restart policy from the Docker host side."
  else
    err "Panel failed to start. Check: tail -n 100 ${LOGFILE}"
    exit 1
  fi
fi

# ---------- Cloudflare Tunnel (no public IPv4 needed) ----------
TUNNEL_STATE="off"
if [[ "$WEB_MODE" == "tunnel" || -n "$TUNNEL_TOKEN" ]]; then
  if [[ -n "$TUNNEL_TOKEN" ]]; then
    _arch="$(dpkg --print-architecture 2>/dev/null || echo amd64)"
    if ! command -v cloudflared >/dev/null 2>&1; then
      ( curl -fsSL -o /tmp/cloudflared.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${_arch}.deb" \
        && dpkg -i /tmp/cloudflared.deb ) > /tmp/phvm-cloudflared.log 2>&1 &
      spinner $! "Installing cloudflared..." || { warn "cloudflared install failed (log: /tmp/phvm-cloudflared.log)"; }
    fi
    if command -v cloudflared >/dev/null 2>&1; then
      cloudflared service uninstall >/dev/null 2>&1 || true
      if cloudflared service install "$TUNNEL_TOKEN" > /tmp/phvm-cloudflared-svc.log 2>&1; then
        ok "Cloudflare Tunnel is running as a service."
        TUNNEL_STATE="running"
      else
        warn "Could not start the tunnel service (log: /tmp/phvm-cloudflared-svc.log)."
        TUNNEL_STATE="failed"
      fi
    else
      TUNNEL_STATE="failed"
    fi
  else
    TUNNEL_STATE="no token"
  fi
fi

# ---------- panel domain ----------
# With Docker available the panel domain is served by the same Caddy that serves websites
# (one proxy on 80/443, automatic free SSL). Nginx + Certbot is only the fallback without Docker.
SSL_OK=0
CADDY_PANEL=0
# Optional hardening: ban SSH brute-force attempts (best-effort, never fatal)
apt install -y --no-upgrade fail2ban >/tmp/phvm-apt-f2b.log 2>&1 && systemctl enable --now fail2ban >/dev/null 2>&1 || true

if [[ -n "$DOMAIN" ]] && command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  step "Domain & SSL"
  info "Serving ${DOMAIN} through the built-in Caddy proxy (free SSL is issued automatically)..."
  warn "Make sure ${DOMAIN}'s DNS A record points at this server's IP."
  echo "PHVM_PANEL_DOMAIN='${DOMAIN}'" >> /etc/phvm.env
  systemctl restart "${SERVICE_NAME}" 2>/dev/null || true
  CADDY_PANEL=1
  SSL_OK=1
  ok "Panel domain set — https://${DOMAIN} works once DNS points here (about a minute)."
elif [[ -n "$DOMAIN" ]]; then
  apt install -y --no-upgrade nginx certbot python3-certbot-nginx > /tmp/phvm-apt-nginx.log 2>&1 &
  spinner $! "Docker is not available — installing Nginx + Certbot for ${DOMAIN}..." || { err "Nginx/Certbot install failed — log:"; tail -n 30 /tmp/phvm-apt-nginx.log; exit 1; }
fi
if [[ -n "$DOMAIN" && "$CADDY_PANEL" -eq 0 ]]; then
  step "Domain & SSL"
  info "Configuring Nginx reverse proxy for ${DOMAIN}..."
  # Everything in this block is best-effort: a failure here should warn and
  # move on, never kill the whole install (the panel itself is already up
  # by this point). Temporarily disable `set -e` for that reason.
  set +e

  cat > /etc/nginx/sites-available/${SERVICE_NAME} <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${PANEL_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/${SERVICE_NAME} /etc/nginx/sites-enabled/${SERVICE_NAME}
  rm -f /etc/nginx/sites-enabled/default

  NGINX_UP=0
  if nginx -t >/tmp/phvm-nginx-test.log 2>&1; then
    if [[ "$HAS_SYSTEMD" -eq 1 ]]; then
      if systemctl reload nginx 2>/tmp/phvm-nginx-start.log || systemctl restart nginx 2>>/tmp/phvm-nginx-start.log; then
        NGINX_UP=1
      fi
    else
      # No systemd: try a live reload first (works if nginx is already
      # running); if that fails, kill any stale master and start fresh.
      if nginx -s reload >/tmp/phvm-nginx-start.log 2>&1; then
        NGINX_UP=1
      else
        pkill nginx >/dev/null 2>&1
        sleep 1
        if nginx 2>>/tmp/phvm-nginx-start.log; then
          NGINX_UP=1
        fi
      fi
    fi
    if [[ "$NGINX_UP" -eq 1 ]]; then
      ok "Nginx is proxying ${DOMAIN} -> 127.0.0.1:${PANEL_PORT}"
    else
      err "Nginx config was valid but the server failed to (re)start. Log:"
      tail -n 20 /tmp/phvm-nginx-start.log 2>/dev/null || true
      warn "Panel is still reachable directly at http://<server-ip>:${PANEL_PORT}"
    fi
  else
    err "Nginx config test failed — check /etc/nginx/sites-available/${SERVICE_NAME}. Log:"
    tail -n 20 /tmp/phvm-nginx-test.log 2>/dev/null || true
  fi

  if [[ "$NGINX_UP" -eq 1 ]]; then
    info "Requesting SSL certificate for ${DOMAIN} (Let's Encrypt)..."
    warn "Make sure ${DOMAIN}'s DNS A record already points at this server's IP, or this will fail."
    if certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "admin@${DOMAIN}" --redirect; then
      ok "SSL certificate installed — panel is now on https://${DOMAIN}"
      SSL_OK=1
    else
      warn "Certbot failed (DNS not pointed here yet, or port 80/443 blocked?). Panel is still reachable over plain http://${DOMAIN}"
      warn "Fix DNS/firewall, then rerun: certbot --nginx -d ${DOMAIN}"
    fi
  else
    warn "Skipping SSL request since Nginx isn't running yet — fix Nginx first, then rerun:"
    warn "  certbot --nginx -d ${DOMAIN}"
  fi

  set -e
fi

# ---------- verify everything the panel needs is actually present ----------
step "Verifying installation"

CHECK_FAIL=0
check_bin() {
  local name="$1" bin="$2"
  if command -v "$bin" >/dev/null 2>&1; then
    ok "$name"
  else
    err "$name — missing (${bin} not found)"
    CHECK_FAIL=1
  fi
}
check_file() {
  local name="$1" path="$2"
  if [[ -e "$path" ]]; then
    ok "$name"
  else
    err "$name — missing ($path)"
    CHECK_FAIL=1
  fi
}

check_bin  "QEMU (system emulator)"      qemu-system-x86_64
check_bin  "QEMU disk utils"             qemu-img
check_bin  "Cloud image tools"           cloud-localds
check_bin  "SSH password auth helper"    sshpass
check_bin  "Git"                         git
check_bin  "Python 3"                    python3
check_file "Python virtual environment"  "${INSTALL_DIR}/venv/bin/python"
check_file "Python dependencies"         "${INSTALL_DIR}/venv/lib"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  ok "Docker (Minecraft / Bot servers run as containers)"
else
  warn "Docker — not available (${DOCKER_STATE}); Minecraft/Bot plans will fall back to VMs"
fi
if [[ -n "$DOMAIN" && "$CADDY_PANEL" -eq 0 ]]; then
  check_bin "Nginx"   nginx
  check_bin "Certbot" certbot
fi

# Cross-check every Python package phvm.py actually imports at the top of
# the file is really installed in the venv — catches a silent pip failure
# that "pip install -r requirements.txt" alone wouldn't surface.
if [[ -f "${INSTALL_DIR}/venv/bin/python" ]]; then
  MISSING_PY=$("${INSTALL_DIR}/venv/bin/python" - <<'PYEOF' 2>/dev/null || true
mods = {"flask": "Flask", "werkzeug": "Werkzeug", "psutil": "psutil",
        "paramiko": "paramiko", "bcrypt": "bcrypt", "cryptography": "cryptography",
        "nacl": "PyNaCl", "discord": "discord.py"}
missing = []
for mod, pip_name in mods.items():
    try:
        __import__(mod)
    except Exception:
        missing.append(pip_name)
print(",".join(missing))
PYEOF
)
  if [[ -n "$MISSING_PY" ]]; then
    err "Python packages missing: ${MISSING_PY}"
    warn "Try: ${INSTALL_DIR}/venv/bin/pip install ${MISSING_PY//,/ }"
    CHECK_FAIL=1
  else
    ok "All Python packages import cleanly"
  fi
fi

if kvm-ok >/dev/null 2>&1; then
  ok "Hardware virtualization (KVM)"
else
  warn "Hardware virtualization (KVM) — not available, VMs will use slower TCG emulation"
fi

if [[ "$CHECK_FAIL" -eq 1 ]]; then
  echo ""
  warn "Some requirements are missing (see above) — the panel may not work fully until these are fixed."
else
  echo ""
  ok "Everything the panel needs is installed."
fi

# ---------- done ----------
SERVER_IP=$(curl -s -4 ifconfig.me || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║${NC}   🚀  ${BOLD}PHvm Panel installed successfully!${NC}      ${GREEN}${BOLD}║${NC}"
echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════════╝${NC}"
echo ""
if [[ -n "$DOMAIN" && "$SSL_OK" -eq 1 ]]; then
  echo -e "  Panel URL:     ${CYAN}https://${DOMAIN}${NC}"
elif [[ -n "$DOMAIN" ]]; then
  echo -e "  Panel URL:     ${CYAN}http://${DOMAIN}${NC}  (SSL not active yet — see warning above)"
  echo -e "  Fallback URL:  ${CYAN}http://${SERVER_IP}:${PANEL_PORT}${NC}"
elif [[ "$WEB_MODE" == "tunnel" ]]; then
  echo -e "  Panel (local): ${CYAN}http://127.0.0.1:${PANEL_PORT}${NC}   Tunnel: ${CYAN}${TUNNEL_STATE}${NC}"
  echo -e "  In Cloudflare Zero Trust -> your tunnel -> Public hostname, add:"
  echo -e "    ${CYAN}${PANEL_TUNNEL_HOST:-panel.yourdomain.com}${NC}  ->  HTTP  ${CYAN}localhost:${PANEL_PORT}${NC}      (the panel)"
  if [[ -n "$CF_API_TOKEN" ]]; then
    echo -e "  Websites: just connect the domain in the panel — the tunnel hostname and DNS record are created automatically."
  else
    echo -e "    ${CYAN}yoursite.com${NC}                ->  HTTP  ${CYAN}localhost:80${NC}               (each website you host)"
  fi
  [[ "$TUNNEL_STATE" == "no token" ]] && echo -e "  ${YELLOW}No tunnel token was given — install it later with:  cloudflared service install <TOKEN>${NC}"
elif [[ "$ON_RAILWAY" -eq 1 ]]; then
  echo -e "  Panel is listening on port ${CYAN}${PANEL_PORT}${NC} inside the container."
  echo -e "  In the Railway dashboard: Service -> Settings -> Networking ->"
  echo -e "  set the Target Port to ${CYAN}${PANEL_PORT}${NC}, then Generate Domain (or add a"
  echo -e "  Custom Domain) — Railway will expose it over https:// with its own SSL cert."
else
  echo -e "  Panel URL:     ${CYAN}http://${SERVER_IP}:${PANEL_PORT}${NC}"
fi
echo -e "  Panel port:    ${CYAN}${PANEL_PORT}${NC}  (change with PHVM_PORT=… when installing)"
echo -e "  Docker:        ${CYAN}${DOCKER_STATE}${NC}  (server data: ${SERVERS_DIR})"
echo -e "  Install path:  ${CYAN}${INSTALL_DIR}${NC}"
echo -e "  Admin login:   ${CYAN}${ADMIN_USER}${NC} / ${CYAN}${ADMIN_PW}${NC}"
[[ "$WEB_MODE" == "tunnel" ]] || echo -e "  Web hosting:   ${CYAN}point each site's domain A record to ${SERVER_IPV4:-$SERVER_IP}${NC}  (ports 80 + 443 must be free)"
echo ""
if [[ "$HAS_SYSTEMD" -eq 1 ]]; then
  echo -e "  Manage service:"
  echo -e "    systemctl status ${SERVICE_NAME}"
  echo -e "    systemctl restart ${SERVICE_NAME}"
  echo -e "    journalctl -u ${SERVICE_NAME} -f"
else
  echo -e "  No systemd in this environment — managed by a background watchdog instead:"
  echo -e "    tail -f ${INSTALL_DIR}/run/phvm.log        # view logs"
  echo -e "    kill \$(cat ${INSTALL_DIR}/run/phvm.pid)     # stop phvm (watchdog restarts it — kill watchdog too if you want it to stay stopped)"
  echo -e "    kill \$(cat ${INSTALL_DIR}/run/watchdog.pid) # stop the watchdog (and phvm won't auto-restart anymore)"
  echo -e "    bash ${INSTALL_DIR}/run/watchdog.sh &        # start it again later"
fi
echo ""
