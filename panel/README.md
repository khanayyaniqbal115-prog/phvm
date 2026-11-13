# PHvm Panel v1.0

Modern KVM management panel with dark UI (HKVM-inspired), public IP pool, web console, and working cloud-init.

## Features

- **Dark modern UI** matching HKVM Panel style (sidebar, cards, stats)
- **Admin-only VM creation** — regular users cannot create VMs
- **Public IPv4 pool** — store public IPs and assign them when deploying
- **Private (NAT) or Public** network mode per VM
- **Cloud-init** with:
  - `root` user + password
  - OS default sudo user (`ubuntu` / `debian`) with same password
  - SSH password auth + PermitRootLogin
  - Root FS resize
- **Web Terminal (SSH console)** via Paramiko
- **QEMU serial** console + web SSH shell
- **SSH** works out of the box (hostfwd + cloud-init)
- Fixed **edit VM** (port conflict checks, disk grow, password update)
- User management, settings, audit log, notifications

## Requirements (host)

```bash
sudo apt update
sudo apt install -y qemu-system-x86 qemu-utils cloud-image-utils wget curl sshpass python3-pip python3-venv
# KVM support
sudo apt install -y cpu-checker
kvm-ok
```

## Install & Run

### Quick install (recommended)

One command sets up everything — host dependencies, Python venv, and a systemd service so the panel auto-starts on boot:

```bash
cd phvm
sudo bash install.sh
```

That's it. It will print the panel URL when done (default `http://YOUR_IP:5050`).

Manage it afterward with:
```bash
systemctl status phvm
systemctl restart phvm
journalctl -u phvm -f
```

### Manual install

```bash
cd phvm
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python phvm.py
```

Open `http://YOUR_IP:5050`

**Admin login:** user `phvm`. On a fresh install the password is **randomly generated** and printed in the panel log on first start (also saved to `ADMIN_PASSWORD.txt` next to the database — delete it after changing the password). Set `PHVM_ADMIN_PASSWORD` to choose your own. Installs that still use the old default `phvm123` show a warning at login.

## Notes

- VMs use user-mode networking + SSH port forward. Public IP is stored/displayed and used as the advertised SSH host; traffic still hits the host on the assigned port.
- For true L2 public IP binding you would need bridge/macvtap setup on the host (not included for safety/simplicity).
- Change the default root password under **Settings**.
- Only **admins** can create / edit / delete VMs and manage users & public IPs.


## Additional nodes (node.py)

1. In Panel → Settings set **Node register token**.
2. On another host:

```bash
pip install flask requests psutil
export PHvm_PANEL_URL=http://PANEL_IP:5050
export PHvm_NODE_TOKEN=your_token
export PHvm_NODE_NAME=node-2
export PHvm_AGENT_PORT=5050
python3 node.py
```

3. The node appears under **Management → Nodes**.

## Nested KVM / CPU

- Nested KVM on → `-cpu host,+vmx,+svm` (guest can use KVM)
- Nested off + host KVM → `-cpu kvm64`
- No host KVM → TCG `-cpu qemu64`

## SMBIOS

Configured under Settings — shows as manufacturer/product in neofetch/fastfetch (default manufacturer: Michael).


## REST API

Create a key under **Profile → API Keys**.

```bash
# User API — list my VMs
curl -H "Authorization: Bearer YOUR_KEY" http://HOST:5050/api/v1/user/vms

# User API — start / stop / restart
curl -X POST -H "Authorization: Bearer YOUR_KEY" http://HOST:5050/api/v1/user/vms/VM_ID/start

# Admin API — list all VMs
curl -H "Authorization: Bearer ADMIN_KEY" http://HOST:5050/api/v1/admin/vms

# Admin API — create VM
curl -X POST -H "Authorization: Bearer ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"name":"web1","os_template":"ubuntu-24.04","ram_mb":2048,"cpu_cores":2,"storage_gb":20}' \
  http://HOST:5050/api/v1/admin/vms

# Admin API — delete VM
curl -X DELETE -H "Authorization: Bearer ADMIN_KEY" http://HOST:5050/api/v1/admin/vms/VM_ID
```

Passwords are never returned by the API list/detail endpoints.


## License verification

The product key is **not** stored in plaintext. Activation compares a salted SHA-256
digest against XOR-masked material embedded in the binary. Tampering with
`license_activated` in the database is insufficient without a matching digest.


## Minecraft & Bot servers on Docker (Pterodactyl-style)

Minecraft and Bot plans run as **Docker containers** (not QEMU VMs): they start in seconds and use far less RAM.

* **Docker install (docker-compose.yml):** the panel container talks to the host's Docker through
  `/var/run/docker.sock`, and server data lives in `/srv/phvm-servers` — mounted at the **same path** on the
  host and in the panel container. Run `mkdir -p /srv/phvm-servers` on the host before `docker compose up -d`.
* **Host install (install.sh):** install Docker on the host (`curl -fsSL https://get.docker.com | sh`); servers are
  stored in `/srv/phvm-servers` (override with `PHVM_SERVERS_DIR`).
* If Docker isn't reachable the panel falls back to the old VM flow automatically. To force VMs, set the setting
  `use_docker_servers` to `0`.
* Minecraft uses `itzg/minecraft-server` (Paper / Purpur / Vanilla), bots use the official `node` / `python` images.
* Limits: RAM and CPU are enforced by Docker; disk size is **not** enforced per server. Connection methods:
  Direct IP:port, Minekube Connect and playit.gg all work (Connection tab); dedicated IPs do not.
* The Docker socket gives the panel root-level control of the host — only run PHvm on a machine you trust it on.

## Security notes

* Behind a reverse proxy? Rate limiting trusts `X-Forwarded-For` only from local/private proxy addresses. Set `PHVM_TRUST_PROXY=1` if your proxy has a public address.
* Serving over HTTPS? Set `PHVM_COOKIE_SECURE=1` so the session cookie is only sent over HTTPS (HSTS is added automatically on HTTPS requests).
* Mounting `/var/run/docker.sock` gives the panel root-equivalent control of the host. Only expose the panel on a network/port you trust and keep the admin password strong.

## Docker server features (v21)

* Live CPU / RAM / disk meters with a sparkline; the disk limit of the plan is enforced (server is stopped at +5%).
* Crash / out-of-memory / disk alerts to a Discord webhook (Setup / Schedule tab).
* Minecraft: Fabric, Forge, NeoForge, Quilt, Modrinth modpacks, Bedrock cross-play (Geyser + Floodgate), world import,
  backup download, auto-restart & auto-backup schedule, players / whitelist / ops, plugin installer (Modrinth).
* Bots: Git deploy, env variables, dependency install, log download.
* Admin → Docker servers: Docker status, container list, orphan cleanup, and one-click migration of VM-based servers.
* Discord bot: Docker servers get Start / Stop / Restart / Console / Logs buttons.

## Ports

The panel listens on **5050** by default everywhere (installer, Docker Compose, Discord links, node agents).
To use another port set `PHVM_PORT` — e.g. `PHVM_PORT=8080 bash install.sh` or `PHVM_PORT=8080 docker compose up -d`.
With a domain, Nginx listens on 80/443 and proxies to the panel port, so users only need `https://your-domain`.

## Web hosting (WordPress + domains + free SSL)

Create a site from **Admin → Create Web Site** or sell it with a plan whose *Type* is "Web Hosting"
(category names containing `web` / `wordpress` default to it). Each site is a WordPress container plus its own
MariaDB container on Docker. In the site panel the owner can:

* open the site on its direct `http://SERVER_IP:PORT` link right away,
* connect up to 5 domains (Domains tab) — create an **A record** pointing at the server IP; a shared Caddy
  container (`phvm-caddy`, ports 80/443) then issues free Let's Encrypt HTTPS certificates automatically,
* manage files (upload / zip / extract / rename / delete / edit), see database details and logs.
* **log in to WordPress in 1 click** (no password; one-time 60-second token) and open **phpMyAdmin** on demand (auto-stops after 30 min),
* **backups** (files + database, restore, download, daily auto-backup, last 10 kept) and an admin-only **staging copy**,
* **settings**: PHP version (8.1–8.4), memory limit, upload size, max execution time, block direct-IP access,
* **domain redirects** (e.g. `www` → main domain) and per-domain HTTPS status with days left.

**Security & monitoring:** the admin dashboard has a Security check (default password, admins without 2FA, ports 80/443,
firewall) and every dashboard shows alerts (expiring/failed servers, disk/memory over 90%) plus live 1-hour charts for admins.

### Public IPv4 or Cloudflare Tunnel (chosen per domain)

In a site's **Domains** tab each domain is connected either with a public IPv4 (A record) or through a Cloudflare Tunnel. `install.sh` asks how the server is reached (and optionally for a tunnel token). With no public IPv4 choose **2** and paste your tunnel token
(Cloudflare Zero Trust → Networks → Tunnels → Create a tunnel). Then add *Public hostnames* in Cloudflare:
`panel.example.com → HTTP localhost:5050` for the panel and `yoursite.com → HTTP localhost:80` for each hosted site.
Cloudflare provides the HTTPS certificate; no ports need to be open. With an optional Cloudflare API token
(Account · Cloudflare Tunnel · Edit + Zone · DNS · Edit, set in the installer or Admin → Settings) the panel creates the Public hostname
and the DNS record itself whenever a site connects a domain (the domain must already be in your Cloudflare account). You can switch modes later in
**Admin → Settings → Web hosting connection**.

### Automatic WordPress install

New sites are installed automatically (WP-CLI, image `wordpress:cli`) with the admin login set in Admin → Settings
(default username `phoenixcloud`, password `phoenixcloud`). The login is shown on the site's Overview; **Install / reset admin login**
fixes older sites. Change the password once the site is public.

### Uptime monitor & easy www

Every 2 minutes the panel checks each web site. The site page shows 24-hour uptime and response time, and the owner gets a notification
(plus an optional Discord webhook, Settings tab) when a site goes down or comes back. When connecting `example.com`, tick
**Also connect www.** to add `www.example.com` and redirect it to the main address in one step.

### WordPress tab & panel backup

Site page → **WordPress**: list/activate/deactivate/update/delete/install plugins, update everything (core + plugins + themes),
maintenance mode, clear caches. Admin dashboard → **Backup panel** downloads a copy of the panel database (keep it private).

### Free Cloudflare link (no domain)

In the Domains tab, **Get free Cloudflare link** starts a quick tunnel that gives the site a public `https://….trycloudflare.com`
address without any domain, account or open port. Each site can have its own; the address changes when restarted.

### Installer questions

`sudo bash install.sh` asks for: connection type, panel domain, public IPv4, admin username and admin password.
For unattended installs set `PHVM_WEB_MODE`, `PHVM_DOMAIN`, `PHVM_SERVER_IP`, `PHVM_ADMIN_USER`, `PHVM_ADMIN_PASSWORD`,
`PHVM_TUNNEL_TOKEN`. The answers are stored in `/etc/phvm.env` (root-only).

Requirements: Docker, and ports **80 and 443 free** on the host for domains + SSL. Data lives in
`PHVM_SERVERS_DIR` (`<site id>/` = WordPress files, `_webdb/` = databases, `_caddy/` = proxy + certificates).

## Buy a domain inside the panel (Spaceship)

Admin → Settings → **Domain shop**: turn it on, add your Spaceship API key + secret, a saved Spaceship contact ID, the price text users see (e.g. `PKR 3500 / year`), how to pay you, and the extensions to offer.
Users open their site → **Domains** → **Get a domain**, search a name and press *Order*. They see your payment instructions. Payment is real money, handled by you (Easypaisa, bank, etc.) — there is no built-in gateway.
When you have the payment, open **Admin → Domain orders** and press *Approve*: the panel registers the domain at Spaceship (1 year, auto-renew off, paid from your Spaceship balance), sets A records for `@` and `www` to the Server IP, and connects both names to the site (www redirects to the main name; free SSL via Caddy). Needs a public IPv4 in **Server IP**.

The welcome bonus was removed; new users start with an empty wallet.

### Card payments with Stripe (optional)

Admin → Settings → Domain shop → *Card payments*: add your Stripe secret key, price and currency. In Stripe → Developers → Webhooks add an endpoint `https://YOUR-PANEL/api/stripe/webhook` for the event `checkout.session.completed` and paste its signing secret (`whsec_…`). Users then pay by card on Stripe's page and the domain is registered and connected automatically. If registration fails after payment, you get a notification and the order shows in Domain orders as `paid_failed` (fix and Approve, or refund in Stripe). Use `sk_test_` keys first. Stripe needs the panel reachable over public HTTPS.


## v21.38 additions

- **Panel domain through Caddy** — Admin → Settings → *Panel domain*. The installer now uses this automatically when Docker is available, so the panel and your websites share one proxy on 80/443 (nginx + certbot only as a no-Docker fallback). Existing nginx installs: `systemctl disable --now nginx`, enter the domain in Settings and press Save.
- **Admin → Domains** — every connected domain with owner, site, connection type, DNS, HTTPS days left and expiry.
- **Domain expiry + renewal** — domains bought in the panel get an expiry date, reminders at 30 / 7 / 1 day(s), and a *Renew* button (Stripe or manual approval). Renewals call Spaceship's renew endpoint.
- **Web hosting plans** — Admin → Web plans (RAM / CPU / disk / domains / days / price). Users pick a plan under *Web Hosting*, pay by Stripe (or manual approval) and the WordPress site is created automatically; renewing extends the expiry. Domain limit is enforced per plan. Stripe webhook handles both domains and plans.
- **Offsite backups** — any S3-compatible storage (AWS S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO). Panel DB daily, automatic site backups right after creation, and a cloud button next to each site backup.
- **Traffic + disk usage** per site (30-day chart); disk warnings at 90% and 100% of the plan storage.
- **Email notifications** — with SMTP configured, users also get emails for orders, domain ready/renewed/expiring, plan renewals, disk warnings and site down/up. Toggle in Settings.

## v21.39 additions

- **Forgot password** — "Forgot password?" on the login page emails a one-hour reset link (needs SMTP and an email on the account).
- **Login safety** — 6 wrong passwords for one account lock it for 15 minutes; the user (and admins, for non-admin accounts) are alerted. The per-IP limit stays.
- **Plan expiry reminders** — website plans send notifications and emails 7 / 3 / 1 days before the end and once when ended.
- **Coupons** — Admin → Web plans → Coupons (percent or amount off, max uses, expiry). Users enter a code when buying a plan, renewing or ordering a domain; a 100% coupon completes the order without payment.
- **Revenue dashboard** — Admin → Revenue: this month / all time, orders by product, 30-day chart, waiting orders, new users, open tickets.
- **Support tickets** — users: Support; admins: Tickets. Replies notify the other side (and email, if SMTP is set).
- **Staging** — owners can make one staging copy of a site and press *Push to live* (the live site is saved as a "pre" backup first).

## v21.40 — Cracked (offline) Minecraft players

New Minecraft servers now start with `ONLINE_MODE=FALSE` and `ENFORCE_SECURE_PROFILE=false`, so cracked launchers (TLauncher, SKLauncher…) can join (secure-profile would otherwise kick them on 1.19+). Admin → Settings sets the default for new servers; each server has a *Cracked (offline) players* switch under Settings that rebuilds the container. Existing servers keep premium-only mode until switched. Cracked mode lets anyone join under any name — use a whitelist or a login plugin (e.g. AuthMe).

## v21.41 additions

- **Wallet top-up by card** (Stripe) — Settings → turn on, set Volts per currency unit and min/max. Wallet page shows "Add Volts".
- **Expired servers** — expired Docker servers (Minecraft, bots, websites) are stopped hourly and cannot be started until renewed; optional auto-delete after N days (Settings, 0 = never).
- **Turnstile** (free Cloudflare bot check) on login, register and forgot password.
- **Public status page** at `/status` — Admin → Status page: add components (name + URL); checked every 2 minutes, 24 h / 30 day uptime.
- **Players online** shown on the Minecraft server page.
- **Referrals** — "Invite friends" link per user; the inviter gets Volts after the friend's first completed purchase (Settings).
- **Admin security** — optional 2FA requirement for admins, admin area limited to chosen IPs (refuses a list that would lock you out), audit log CSV download.

## v21.42 additions

- **Update from the panel** — Admin → Update panel: upload a zip (or paste a URL in Settings). The zip is checked, code and DB are backed up, files replaced (database, secret key, admin password file, servers and backups are never touched) and the panel restarts. One-click rollback.
- **Speed boost + Cloudflare purge** (per site) — long browser cache for static files plus zstd/gzip compression; "Purge cache" calls Cloudflare if the site's domain is on your Cloudflare account.
- **Admin alerts** — Discord webhook and/or Telegram bot for new orders, tickets, failed paid domains and sites going down (Settings → Alerts, with a Test button).
- **Reseller role** — Users → edit → Role = Reseller. Resellers get a *Reseller* page: create customer accounts and websites for them, paid from the reseller's wallet at a discount (Settings → Reseller discount, default 20%). Resellers can open/manage their customers' sites.
- **Plan upgrade** — "Upgrade an existing site" on the Web plans page. Only bigger plans; you pay the price difference. RAM / CPU / domain limit change immediately.
- **WordPress malware scan** — Scan button per site (PHP in uploads, eval/base64 backdoors, known patterns) plus a weekly automatic scan with alerts.
- **Receipts** — every paid order (plan, domain, top-up, upgrade) gets a printable receipt under *Receipts*.
- **Urdu / English** — "اردو" button in the top bar switches menus and common labels to Urdu (right-to-left); other text stays English. Saved in the browser.

Untested against real services: Docker, Stripe, Spaceship, S3, Cloudflare, SMTP, Discord/Telegram (tested with mocks only).

## v21.43 additions

- **Setup check** (Admin → Setup check) — one page that tests Docker, Caddy, ports 80/443, disk, RAM, HTTPS domain, default admin password, SMTP, Stripe, Spaceship, Cloudflare, backups and alerts. Run it on the real server first.
- **Local payments** — Settings → JazzCash / Easypaisa / bank / WhatsApp; shown on every manual order, together with "send the screenshot".
- **Legal pages** — /legal/terms, /legal/privacy, /legal/refund (sample text until you write your own), linked in the footer.
- **Free subdomains** — Settings → base domain (e.g. sites.yourdomain.com) + wildcard DNS; customers pick name.sites.yourdomain.com on their site page.
- **Email forwarding** — per site: info@theirdomain.com → their real inbox, via Cloudflare Email Routing (needs the Cloudflare token; domain must be on Cloudflare). Receiving only; this is not a mailbox host.
- **Hardening** (Settings, on by default) — security headers, HSTS, PHP blocked inside uploads, xmlrpc.php blocked; fail2ban for SSH is installed by install.sh.
- **Speed** — PHP OPcache enabled for new/updated sites (existing sites get it after saving site settings).

Not code: multiple servers/data centers, uptime guarantees, brand trust, a real security audit and full mailbox hosting. Those need your hosting setup, time and (for mail) a mail server such as Zoho/Mailcow.

## v21.44 — DDoS shield (Admin → DDoS shield)

- **Flood protection** — Caddy's access log (all hosted sites + the panel domain) is read every 3 seconds; an IP sending more than N requests in S seconds (default 150 / 10 s) is banned with a firewall DROP (DOCKER-USER + INPUT) for a set time, then unbanned automatically. Bans survive a panel restart. The panel itself also has its own limiter (120 requests / 10 s per IP; admins and private IPs are exempt).
- **Network shield** (optional button) — SYN cookies and kernel hardening, per-IP new-connection rate limit, max simultaneous connections to ports 80/443, ICMP and UDP flood limits. SSH and the panel port are never limited.
- **Cloudflare Under Attack mode** — one click for every domain on your Cloudflare account (token needs Zone Settings: Edit).
- Whitelist, manual ban/unban, busiest IPs and an event list; Discord/Telegram alert on every ban.

Honest limit: software on the server cannot stop a flood bigger than the server's own internet link. For that, keep domains behind Cloudflare (free plan is fine) and ask your VPS provider about their DDoS filtering. Needs the panel to run as root with iptables installed.

## v21.45 — Turbo engine (OpenLiteSpeed)

- New websites can run on **OpenLiteSpeed + LiteSpeed Cache** instead of Apache. Choose the default in Settings → *Web engine for new websites*, or per plan in Admin → Web plans (Engine: Standard / Turbo). Existing sites keep Apache.
- The panel downloads WordPress with WP-CLI, writes wp-config.php, installs the LiteSpeed Cache plugin and keeps everything else (MariaDB, Caddy SSL, backups, staging, scan, phpMyAdmin, SSO login) the same.
- PHP limits for Turbo sites are written to `.user.ini`. Image tag: `litespeedtech/openlitespeed:<ols_version>-lsphpNN` (default 1.8.3 — change the `ols_version` setting if Docker Hub has a newer tag).
- **Untested on a real server** (only the container arguments and file flow are tested with mocks). Try one Turbo site first; if anything misbehaves, switch the default back to Standard.

## v21.46 additions

- **Site tools** (website page → Settings): one-click *Update WordPress, plugins & themes*, *Maintenance mode* on/off, *Reset WP admin password* (shown once), weekly **auto-update** and optional **real cron** (every 10 minutes).
- **Announcement banner** — Admin → Settings → Announcement banner: one message at the top for every user (info / warning / urgent); users can dismiss it, a new message shows again.

## v21.47 — Connection doctor (players / SSH cannot connect)

- **Public IP is now always IPv4.** Before, a dual-stack VPS could report its IPv6 address, which players cannot use. Detection forces IPv4 and Setup check warns if it fails (then set *Server IP* in Settings).
- **Auto-open firewall ports** — every 2 minutes the panel opens all Minecraft / bot / website / SSH ports in the server's own firewall (ufw, firewalld, or iptables with default DROP).
- **Admin → Connection doctor** — per port: is something listening, does the public IP answer, and what to do. "Open all ports now" button.
- Cloud/provider firewalls (security groups, "network rules" in your VPS dashboard) cannot be changed from the server. Open TCP+UDP 25565-25700 and the SSH range (10000-30000) there.

## v21.48 additions

- **Payment proof** — *My orders*: customers upload a screenshot/PDF (PNG, JPG, WEBP, PDF, max 4 MB) on a pending order; admins see a *Proof* button next to Approve (Web plans and Domain orders) and get an alert.
- **Auto-renew from wallet** — per site (Site tools): one day before the end, the plan price is taken from the wallet in Volts and the site is extended; a failed attempt notifies the user once a day.
- **Free trial** — Settings → Free trial: pick a plan and hours; one trial per user and per IP.
- **Payouts** — Settings → Payouts: users request a withdrawal of Volts (Withdraw page), Volts are held; Admin → Payouts: *Mark paid* or *Reject* (returns the Volts).
- **WordPress starters** — shop (WooCommerce), business (Elementor), blog, portfolio: installs theme + plugins with one click (Site tools).
- **Site health score** — 0-100 with what to fix (running, domain, backup, auto-update, scan, speed, PHP, days left).
- **Panel backup / restore** — Admin → Panel backup: password-protected zip of the database + secret key; restore keeps a copy of the current database.
- **CPU / memory graphs** — every Docker server (link on the server and website pages), sampled every 5 minutes for 7 days; owners are notified after 15 minutes of near-full CPU.
- **Install as an app (PWA)** — manifest, icons and service worker; "Add to home screen" on phones.
- **Status page** — incident history, email subscribers (double opt-in) and alerts when a component goes down/comes back (needs SMTP).
- **Login alerts** — a notification (and email) when an account logs in from a new IP.

Already in the panel from before: Minecraft plugin search/install and Modrinth modpacks, Git deploy for bots, 2FA for all users.

## v21.49 — Mobile friendly

- New `static/mobile.css` (loaded last). Checked on 320, 360, 390 and 768 px wide screens across 37 pages: no sideways scrolling.
- **Fixed: the side menu was permanently open on phones** (its entrance animation overrode the "hidden" position). It is now closed, opens with the ☰ button and closes when you tap outside.
- Top bar shortened on phones (page title, language, theme, notifications, avatar); menus open full-width.
- Tabs scroll sideways, forms and button rows stack, inputs are 16 px (no iOS zoom), tap targets 44 px, wide tables scroll inside their card, long domains and URLs wrap.
- Together with the v21.47 PWA support: open the panel in Chrome/Safari → "Add to Home screen".

## v21.50 — VM identity in neofetch / fastfetch / screenfetch, free link fixes

- **Host** now reads **Phoenixcloud** in every tool (SMBIOS product/family/board/BIOS are set; the old "PHvm Virtual Machine 1.0" is gone). Takes effect when a VM is restarted.
- **CPU** shows the real host CPU name. With KVM the host CPU is passed through; without KVM (software emulation) the emulated CPU gets the host's name instead of "QEMU Virtual CPU". Optional override: Settings → *CPU name shown inside VMs*.
- **GPU** reads **PHvm Panel Virtual Machine** — in neofetch and fastfetch (their config files) and now also in screenfetch and anything using `lspci` (the guest's PCI name list is renamed on first boot). For VMs that already exist: Admin → Setup check → *Apply to all running VMs*, then restart each VM once. A package upgrade of `pci.ids` can undo the GPU rename; the same button restores it.
- **Free Cloudflare link** — the tunnel now uses IPv4 only (the usual reason it never connected on IPv4-only Docker networks) and falls back from TCP (http2) to UDP (quic) when one is blocked. If it still fails, the message says to open outgoing port 7844.

## v21.51 — Animations
- New `static/anim.css` + `static/anim.js`: staggered entrance of cards/stats/tables, scroll reveal, count-up numbers, button ripple, page cross-fade (View Transitions), top loading bar, pulsing live dots, dropdown/tab/flash pop-ins, hover polish.
- Profile menu → **Animations: On/Off** (saved in the browser). OS "reduce motion" is respected; phones get lighter effects.
- Old entrance animations switched from `both` to `backwards` so hover/tilt and the mobile menu are never pinned.

## v21.52 — Scheduled backups, retention, restore
- VM page → Backups: **Auto** backup or snapshot every 6 h / 12 h / daily / 3 days / weekly, keep the newest 1–14 (only `auto` ones are pruned; manual ones stay).
- New **Restore** button on backups (VM must be stopped). The old disk is kept once as `disk.qcow2.before-restore`.
- Owner gets a notification if an automatic run fails or is skipped (e.g. low disk space).
- Applies to normal (QEMU) VMs; Minecraft/bot/web servers already had their own auto-backup.

## v21.53 — playit without a key
- Minecraft server → Connection tab → **Start playit — no key needed**. The agent starts in claim mode, the panel shows the `https://playit.gg/claim/...` link; open it once, approve, then add a Minecraft Java tunnel to `127.0.0.1:25565` in the playit dashboard. The agent's login is kept in the server's backup folder, so restarts keep working.
- Pasting a secret key still works.

## v21.54 — "Can't connect?" checks + any client version
- Minecraft server → Connection tab → **Run checks**: running/started, port published and listening, IPv4 server IP, exact address to join, cracked state, Minekube-with-cracked conflict, whitelist, version, and known kick messages from the log (failed to verify username, outdated client, not whitelisted…).
- **Allow any client version** installs ViaVersion + ViaBackwards + ViaRewind (Modrinth) and restarts, so cracked launchers on other versions can join (Paper/Purpur/Spigot).

## v21.55 — Polish + accent colours
- `static/polish.css` / `polish.js`: aurora background, gradient page titles, calmer card headers, nicer tables / inputs / badges / dropdowns / scrollbars, readable toasts in light mode.
- Profile menu → **Accent** dots (indigo, emerald, rose, amber, cyan, violet). Saved per browser, applied before first paint, works in dark and light themes.

## v21.56 — Danger style
- `static/danger.css`: black glass, sharp corners, neon edge glow, corner brackets, uppercase mono labels, scan-line under the top bar, glitch on the brand. On by default; Profile menu → **Style: Danger / Soft** switches back to the softer look (saved per browser).
- New accents: crimson (default), toxic, plasma, ice — plus the older six.

## v21.57 — Danger style on public pages
- Login, register, 2FA, license and landing pages now use the Danger look too (`static/danger-pub.css`), follow the chosen accent, and respect the Soft style switch.

## v21.58 — Stay signed in + quick jump
- **Login fix:** the session cookie used to die when the browser/tab was closed, so you landed on the login page again. Sessions are now persistent (30 days, refreshed on use). New login checkbox "Keep me signed in on this device" (ticked by default; untick on shared computers).
- **Quick jump (Ctrl+K or `/`)**: command palette that searches every sidebar page and every server/link on the current page. Also in the profile menu.

## v21.59 — HUD polish (Danger style)
- Bottom status bar: online/offline, live ping to the panel, your username, clock, version, Ctrl+K hint.
- Faint HUD grid, blinking section markers, `//` page-title prefix, segmented resource bars.
- Cursor reticle on desktop (grows over buttons/links) and a one-second boot flash once per browser session.
- All of it is hidden with Profile menu → Style: Soft; the boot flash and blinking also respect "reduce motion" and the Animations switch.

## v21.60 — Sidebar HUD (Danger style)
- New sidebar: framed brand with a "link secure" signal strip, `// SECTION` headings, square icon tiles, numbered entries, glowing active bar with `▸`, hover slide, HUD user card with corner brackets, glowing right edge. `static/sidebar-hud.css`. Soft style keeps the old sidebar.

## v21.61 — Speed + one consistent HUD
- **Faster loading:** the page used to pull 14 font stylesheets (render-blocking) and ~15 CSS/JS files; now fonts load without blocking (only Inter, Space Grotesk, JetBrains Mono + your chosen font), Font Awesome is non-blocking, the ~45 KB of inline CSS per page moved to a cached file, and everything is bundled into **one CSS (73 KB → 14 KB gzipped) and one JS (19 KB → 7 KB gzipped)**, content-hashed and cached for a week. The accent script is inlined (no request).
- Night-sky background canvas: static moon/mountains drawn once, 30 fps cap, fewer stars, skipped on very low-end devices.
- Bundles rebuild automatically on every restart from `static/*.css|js` (the order list is `_ASSET_CSS` / `_ASSET_JS` in phvm.py). If you add a CSS file, add it to that list.
- UI consistency: page-local cards (install pages etc.) and the admin "All VMs" sidebar row now follow the HUD style.

## v21.62 — Back to Black + Platinum
- The default look is the original **Black + Platinum** again. The night-sky/space background (stars, moon, mountains) is removed everywhere.
- The Danger/HUD look is now **opt-in**: Profile menu → *Style: Platinum* switches to Danger (page reloads); the accent colour dots only show in Danger. Nothing of it is loaded in the default look (smaller, faster).
- Speed work from v21.61 stays: one cached CSS + JS bundle, non-blocking fonts. Danger CSS is a second bundle (`_ASSET_XCSS`) fetched only when Danger is on.

## v21.63 — Performance pass
- **Server status cache:** every dashboard / server-list page used to run one `docker inspect` / `pgrep` per server before answering. Status is now served from a 3-second cache and refreshed in the background (power actions clear it at once). On a test box with 25 servers the dashboard dropped from ~116 ms to ~2 ms per request once warm; on a real Docker host the saving per server is larger.
- Removed the 3D card-tilt script (a mousemove + MutationObserver on every card), throttled the card spotlight to one update per frame, removed the duplicate number count-up, removed GPU-heavy blur behind every card and the sidebar.
- Dashboard no longer hard-reloads every 30 s: every 60 s, only when the tab is visible and nothing is being typed. Overview polling and the clock pause in background tabs.

## v21.64 — Every language
- Top bar: new **language menu** (globe button): English, اردو (built-in dictionary, works offline), 28 popular languages, searchable, and **"More languages (all)…"** which opens Google's full list (100+ languages).
- Non-Urdu languages use the free Google Website Translator, loaded only after you pick one (nothing extra loads for English/Urdu). The choice is kept in a cookie, so every page stays translated. Terminal/console/code areas are marked "do not translate".
- Needs the visitor's browser to reach `translate.google.com` (blocked in some countries). The CSP header now allows `translate.google.com`, `translate.googleapis.com` and `www.gstatic.com`.
- Translation is machine translation of the panel text; user-written content (server names, tickets) is translated too.

## v21.65 — Shop shows plans
- **Shop** is now the one place to buy: all server plans (VPS, Minecraft, bot, web hosting) as cards with specs, price, "Buy now" and a "needs ⚡X more — top up" hint, filter tabs (All / Servers / Minecraft / Bot / Web / Items), plus the old one-off items. Before, it only listed shop items, so it looked empty when none were added.

## v21.66 — Real global search
- The top-bar search now searches the whole panel while you type (2+ letters): **servers** (name, id, port; admins see everyone's, with owner), **users** (admin: username/email) and **tickets** (subject). Arrow keys + Enter, grouped results. Users only ever see their own servers/tickets. The old "filter this page's table" still works at the same time.
- Fixed: the Ctrl+K palette no longer hijacks clicks on the top-bar search box.

## v21.67 — Stability hardening
- Dashboard/VM list status cache: ek kharab VM row ab poore dashboard ko 500 nahi karta (status "unknown/stopped" dikhata hai).
- Full route audit (584 checks) + 47 page browser crawl: koi JS error ya 4xx nahi mila.

## v21.68 — Minecraft subdomain (play.yourdomain.com → server)
- Admin → Settings → "Minecraft subdomain base" (e.g. `mc.yourdomain.com`) + Cloudflare API token (Zone → DNS: Edit). Domain Cloudflare mein hona chahiye.
- Server → Connection tab → "Your own server address": user naam chunta hai (`myserver`) aur panel Cloudflare mein **A + SRV (`_minecraft._tcp`)** record khud banata hai. Players sirf `myserver.mc.yourdomain.com` likhte hain — port ki zaroorat nahi.
- Naam unique, reserved names blocked, change/remove ho sakta hai, server delete par DNS records khud hat jate hain. Connection tab ka "Current address" ab subdomain dikhata hai.

## v21.69 — Cloud Storage hosting, MC status page, QEMU CPU alerts
- **Cloud Storage hosting**: Admin → Web plans → Engine = "Cloud Storage". Plan kharidne par user ko apni web-drive milti hai (File Browser container): upload/download/preview, share links, extra users. Login admin + auto password (panel mein Show/Copy/New password), apna domain ya free subdomain (Domains tab), 20 GB tak upload, disk quota meter. Shop mein "Cloud Storage" filter tab.
- **MC public status page**: `/mc/<name>` (ya `/mc/<name>.<base>`) — Online/Offline + players; `?json=1` se JSON. Subdomain card mein link dikhta hai.
- **QEMU VM CPU alerts**: VM 5 minute lagatar ≥90% CPU (Settings key `vm_cpu_alert_pct`) par chale to owner ko panel notification + admin Discord/Telegram alert (1 ghante mein ek baar).
- Fix: Storage page JS helper, installing steps for storage.

## v21.70 — Cloud Storage: automatic subdomain
- Naya Cloud Storage bante hi usko apna subdomain `<naam>-xxxx.<free subdomain base>` mil jata hai (Admin → Settings → Free subdomain base; wildcard DNS `*.base` → server IP chahiye). Storage ka web drive usi address par khulta hai. Base set na ho to IP:port address milta hai.

## v21.71 — Cloud Storage UI polish
- Naya storage page: hero card (logo, naam, Running/Stopped pill, Start/Restart/Stop), address + login copy-fields, gol usage ring (% aur GB), "What you get" chips, mobile par single column. Black + Platinum style, Danger/HUD opt-in hi rehta hai.

## v21.72 — Cloud Storage: domain + subdomain dono
- Custom domain (Domains tab → A record server IP par) aur free subdomain dono se storage khulta hai (Caddy auto HTTPS, 20 GB upload). Auto-bana subdomain ab "Change free name" se apni pasand ka naam kiya ja sakta hai.

## v21.73 — Cloud Storage labels
- Dashboard / My VMs / installing page par Cloud Storage ab "Cloud Storage" likha dikhta hai ("Web hosting" nahi).

## v21.74 — Subdomain for every server + disk-full warning
- **Subdomain sab ke liye:** Minecraft (A + SRV), Cloud Storage / Web (Domains tab, auto free subdomain), ab **VPS aur Bot servers** ke liye bhi "Your own address" card (VPS manage page / Bot Setup tab). Cloudflare mein A record khud banta hai (Admin → Settings → "Minecraft subdomain base" + Cloudflare token; wahi base sab ke liye). SSH command aur forwarded ports naam ke saath dikhte hain.
- **Disk warning:** koi bhi Docker server (MC, Bot, Web, Storage) plan ke 90% disk par pahunche to owner ko notification (12 ghante mein ek baar); limit cross hone par server rukne ka purana behaviour waisa hi.

## v21.75 — Bug fix
- Cloud Storage "New password": app chalte waqt database lock hota hai; ab panel storage ko 1-2 second ke liye rok kar password badalta hai aur wapis start karta hai.
- Full audit (602 route checks + 15 pages × 2 widths browser crawl): koi aur error nahi mila.

## v21.76 — Cloud Storage backups
- Storage page par naya **Backups** tab: Create backup (files + drive ke users/share links), Download, Restore, Delete. 5 newest rakhe jate hain. Restore se pehle archive poora check hota hai (bad/unsafe archive reject, live data safe), storage restore ke dauran 1-2 minute ke liye rukta hai aur khud wapis start hota hai.

## v21.77 — HUD 2K
- Danger/HUD style ab bari screens par scale hoti hai: 1900px+ (Full HD) ×1.18, 2400px+ (2K/QHD) ×1.4, 3200px+ (4K) ×1.9 — sab kuch (sidebar, tables, status bar) sahi nap par rehta hai. Retina/high-DPI par borders patle (0.5px). Sidebar ke neeche "Admin Panel" ab kat-ta nahi. Sirf Danger style mein; default Black+Platinum waisa hi.

## v21.78 — No more red
- Danger/HUD style ka default accent ab **Platinum** (silver) hai, red/crimson nahi; accent picker mein "Platinum" sabse upar. Platinum buttons par text dark rehta hai (padhne layak).
- **One-time reset:** purane browsers mein saved "danger" style aur "crimson" accent ek baar reset ho kar default Black + Platinum par aa jate hain (`phvm_style_v=3`). Danger sirf tab dubara chalu hota hai jab user khud Style badle.

## v21.79 — Clean Black + Platinum only
- Danger/HUD style ka option poora hata diya (profile menu se Style/Accent bhi) — purana saved "danger" ab kabhi activate nahi hota.
- Background se dot-grid, floating glow orbs aur grain hata diye: seedha saaf kala (Black + Platinum), space jaisa kuch nahi.

## v21.80 — Subdomain self-healing
- Har ghante (aur panel start ke 3 min baad) panel check karta hai ke subdomains ke Cloudflare records sahi hain. Server IP badle ya MC ka port badle to A/SRV record khud theek ho jata hai; server delete ho to uske records hat jate hain. Sirf tab chalta hai jab subdomain base + Cloudflare token set ho.

## v21.81 — Admin "Subdomains" page
- Admin sidebar → **Subdomains**: sab servers ke subdomains ek table mein (address, server, type, owner, date), "Check DNS now" button (abhi resync) aur har row par Remove (Cloudflare records bhi hat jate hain).

## v21.82 — 10 upgrades
1. **Server list filter** (Dashboard / My VMs): naam se search + All/Running/Stopped chips.
2. **Login/Register par Show/Hide password**.
3. **Browser tab title** mein unread notifications, jaise `(2) Dashboard`.
4. **`/healthz`**: uptime monitors ke liye (public, sirf `ok` + version).
5. **Subdomain "Test" button** (MC, VPS, Bot): DNS sahi IP par point kar raha hai ya nahi, saaf message ke saath.
6. **Admin → Subdomains**: har row par live DNS status (OK / Wrong IP / Not visible).
7. **Admin → Subdomains CSV export**.
8. **Admin dashboard health card**: CPU, RAM, Disk (free GB), Load, Docker containers, server uptime (15 s live).
9. **Cloud Storage**: 90%+ full hone par warning banner + saare connected addresses copy ke saath.
10. **Cloud Storage daily auto-backup** (Backups tab mein checkbox; 5 newest rakhe jate hain).

## v21.83 — Speed + UI + Team access
- **Speed:** Admin dashboard har baar 0.3 s ruk-ta tha (CPU measure sleep) — ab ~3 ms (pehle ~305 ms). Extra DB indexes (domains, usage, tickets).
- **UI:** Server page ke tabs ab ek hi row mein (side scroll + fade), console chhota/behtar fit, khali jagah kam, active tab highlight.
- **Team access (naya feature):** Minecraft/Bot server par "Team access" card — owner kisi bhi registered user (username/email) ko *manager* bana sakta hai (max 5): console, files, start/stop/restart. Manager server delete, reinstall, subdomain/domain, billing ya team access nahi chhed sakta (allowlist). Manager ko sidebar mein **Shared with me** page milta hai. Owner kabhi bhi Remove kar sakta hai.

## v21.84
- 3 new hosting types alongside Cloud Storage: Password Manager (Vaultwarden), Uptime Monitor (Uptime Kuma), Code Editor (code-server). Pick the engine per plan in Admin → Web plans.
- Generic app page, backups, domains, file manager and password reset (storage/code) for all apps.
- MC / Bot / Web pages: new hero-card header (icon tile, status pill, power buttons). Black + Platinum only.
- Notes: Vaultwarden and code-server need an https domain.

## v21.85
- New hosting: Code Sandbox (JupyterLab, Python + data tools). Choose engine "sandbox" in Admin -> Web plans. Needs an https domain; token/password shown in panel, reset supported.

## v21.86
- New hostings: VS Code Studio (linuxserver code-server), R Studio. Engines: vscode, rstudio (Admin -> Web plans).

## v21.87
- Game hosting: Palworld Server (udp 8211) and Hytale Server (udp 5520). Engines palworld / hytale in Admin -> Web plans. Address is server_ip:port, Logs tab shows the Hytale login link.

## v21.88
- Palworld (rcon) / Hytale console box in the Logs tab.
- Alerts card on app pages: Discord webhook + Telegram (crash, stop, down).
- Auto-stop when idle (code apps only, per site; owner chooses hours; press Start to wake).

## v21.89
- /apps page (search all hosting types + your apps), admin "All apps & load" page, Graphs button on app pages, overload guard (admin + user alert when an app sits at its CPU/RAM limit for 10+ min).

## v21.90
- AI assistant: chat button for logged-in users. Admin -> AI assistant: paste an Anthropic API key, switch on. Can answer panel questions, read logs, start/stop/restart the user's own servers. Cannot delete/buy/change passwords.

## v21.91
- Sandbox VM: new plan type (Admin -> Plans -> Type "Sandbox VM"). A KVM VPS with Docker + Compose installed on first boot, inside the VM (isolated from the host). VM page shows a Docker quick-start card with one-click copy recipes (Nginx, Portainer, Postgres, Kuma, n8n).

## v21.92
- Snapshots + Rollback for apps (Backups tab): snapshot now, auto snapshots every 1/6/12h, safety snapshot before every rollback.
- AI "Fix it" button on server/site/app pages (needs the AI assistant switched on).
- Live globe card on the dashboards (admin sets host latitude/longitude once).
- Fixed: backup restore used the wrong file owner for apps that do not run as www-data.

## v21.93
- Public status badge (SVG), widget (iframe) and JSON per server; opt-in public Server list at /servers with 12h votes and optional Volts reward (admin sets 0-5).
- Discord: phvm!servers, srvstart, srvstop, srvrestart, srvstatus, srvlogs for Docker servers (Minecraft, bots, sites, apps).

## v21.94
- Uptime % + incident timeline card on every Docker server page; upgrade suggestion after repeated limit hits.
- AI instant first reply on support tickets (Admin -> AI assistant switch).
- Achievements page: 10 badges, levels, masked top-10 board.

## v21.95
- Shell inside any Docker server (Open shell on the uptime card): docker exec in a pseudo-terminal, max 3 per user, owner/admin only.
- Phone/desktop push alerts (profile page): self-contained Web Push (VAPID + aes128gcm), no extra packages; needs https.
- Reseller business report (customers, sites, 6-month spend, top customers).
- Template marketplace (/templates): publish a setup from a Minecraft/Code/Sandbox/VS Code/R server, admin approves, buyers install; seller keeps 100-fee% (default fee 10%). Safe extract (no abs paths, .., links, devices).

## v21.96
- Maintenance mode: Admin → Maintenance. Turn on now or schedule start/end; users see a 503 "back soon" page (admins, login, status page and node agents still work). A countdown banner appears 48h before a scheduled start.
- Sale campaigns: Admin → Sale campaigns starts a percent coupon plus a site-wide countdown banner (coupons work on website plans and domains, not VM plans).
- Cost & profit report: Admin → Cost & profit. Enter monthly costs; see 6-month revenue vs profit and cost per running server.
- Server health score (0-100) card on every Docker server page: uptime, recent backup, disk, plan expiry, crash alerts, 2FA.
- New-device login alerts: a notification (and push if enabled) when an unknown browser/OS signs in; My Profile lists devices with Remove.
- API: Docker servers (Minecraft, bots, sites, apps) now work with start/stop/restart; new status and logs endpoints; API docs page with curl examples.
- What's new page (/changelog) built from this file.

## v21.97
- Admin can create Palworld, Hytale and every other app directly: Create App / Game (sidebar) or the "Apps & games" tab on the create page.
- Settings → General is split into a left menu with one page per topic (Basics, Wallet, Alerts, Payments, Security, Backups, Stripe, SMTP …). One Save button still saves everything.
- Expiry reminders: users are notified 7, 3 and 1 day before a server expires (once per stage).
- Audit log filters: search text, user, action and period.
- Panel health page (Admin → Panel health): CPU, RAM, disk, swap, Docker and warnings, refreshed every 5 seconds.

## v21.98
- Fixed a JavaScript error on My Profile (phone alerts card ran before its script loaded).
- Maintenance mode no longer blocks Stripe payment webhooks, Discord login or status-page email links.
- Settings: "Find a setting" search box above the menu.
- Admins see a reminder bar on every page while maintenance mode is on.
- Creating Palworld/Hytale with too little RAM now shows a warning.

## v21.99
- install.sh menu: new option 5 "Change admin e-mail & password" (also `sudo bash install.sh reset-admin`). It updates the existing admin in place, asks for e-mail and password twice, switches off 2-factor, clears login locks, removes the stale ADMIN_PASSWORD.txt and restarts the panel.
- The old `create-admin` command used to DELETE the account first (which could orphan its servers); it now uses the same safe in-place update.
- The installer now asks for the admin e-mail too.

## v21.100
- Privacy fix: the Dashboard no longer lists other users' servers to normal users (admins still see all).
- Admin → Edit user → "Locked out?": clear the login lock, switch off 2-factor, or force a password change.
- Users see an "expires in N days" bar with a Renew button for servers ending within 7 days.

## v21.101
- New checkout on Web plans: one window for new site / renew / upgrade, with live price, coupon check and three ways to pay.
- Pay with Volts (wallet): instant, no admin approval. Price in Volts = price x "Volts per currency unit" (same rate as auto-renew). A failed payment never keeps a coupon use.
- Upgrades charge only the difference to the current plan; renewals add the plan's days.
- The "expires soon" bar now opens the renew window for that site directly (`/web-plans?renew=VM_ID&plan=ID`).

## v21.102
- New Billing page (sidebar → Account → Billing): wallet, renewals due in 30 days, how much you would have left, a warning if Volts are short, 6-month spent/added bars and latest activity.
- Auto-renew can be switched on/off for every plan-based server from one table.
- Wallet-low warning: 3 days before an auto-renew, once a day, if the wallet cannot cover it.

## v21.103
- Admin sidebar reorganised into 5 collapsible groups: Servers (with Create and Infrastructure sub-lists), Users & support, Sales & money, Health & security, Panel. The group of the current page opens by itself; your open/closed choice is remembered.
- Audit log is now in the sidebar (Users & support).

## v21.104
- Terminal is much more responsive: the server now answers a read the instant output exists (long-poll, no 20 ms sleep loop), the browser re-polls at once (no 80 ms pause), and typed keys go out in order and merged. Measured send-to-echo inside the panel: about 3 ms (was 100-250 ms).
- Fixed: terminal read/send/resize/disconnect answered with an error (HTTP 500) on malformed input.

## v21.105
- Terminal: live latency badge (browser to panel and back, in ms), "My commands" (save up to 12 commands, one click runs them; stored in your browser), colour themes (Dark/Black/Green/Light, remembered) and "download this session as a text file".

## v21.106
- Minekube + cracked players: Minekube Connect only lets premium accounts in unless `allow-offline-mode-players: true` is set in plugins/connect/config.yml. The panel now keeps that setting in step with the server's Cracked mode (checked every minute; restarts the server once if it had to change, and tells the owner).
- Connection doctor: replaces the wrong "Minekube only forwards premium accounts" message with a real check, and adds playit.gg ping tips (choose a closer datacenter in playit, compare at ping.playit.gg).

## v21.107
- Minecraft Performance card on the server page: live TPS (Paper/Purpur), CPU and RAM use, current view/simulation distance, advice when the server lags, and one-click presets (Smooth / Balanced / Pretty) with optional restart.


## v21.108 — Speed
- Server list/dashboard status now uses ONE `docker ps` (cached 2 s) instead of one `docker inspect` per server.
- Runtime of all servers is loaded with one SQL query (was one query per server per page).
- Start/Stop still show the exact state immediately (cache is reset on those actions).

## v21.109 — DDoS shield: always ON + stronger
- DDoS protection can no longer be switched off (no toggle, setting ignored; network shield re-applied on every start).
- Panel guard: bans live in memory (no SQL per request), anonymous visitors 100 req/10 s, burst limit, over-long URLs refused (414).
- URL-scanner ban (30+ missing pages/minute), repeat offenders get 4x longer bans (max 7 days).
- Firewall shield: drops invalid/malformed packets, limits panel-port connections, private/Docker networks exempt.
- Web server: connection limit 600, 60 s idle timeout, header size cap (slowloris resistance).
- Limit: a flood bigger than the server's internet link needs Cloudflare/provider protection.

## v21.110 — Cyber-HUD skin + security helpers
- `static/hud-master.css` / `hud-master.js`: Cyber-HUD look, now OPTIONAL (v21.112): default is the classic Black + Platinum UI; the **HUD** button in the top bar turns the neon look on (remembered per browser).
- `core_upgrades.py`: opt-in helpers — HMAC node signature decorator (needs `NODE_CLUSTER_SECRET`, no default secret), remote license check (only if `LICENSE_VERIFY_URL` is set), plain 403/429 pages.
- `upgrade_cleanup.sh`: moves `license_server.py` and `generate_license_key.py` out of the panel folder. It does NOT delete `sidebar-icon.png` (the panel uses it).
- `docker-compose.yml`: optional host mount for backups.

## v21.111 — Bug fixes
- Browsers' automatic `/favicon.ico` and `/robots.txt` requests no longer return 404 (they were counted by the URL-scanner ban and could ban real visitors on shared IPs).
- Logged-in admins are never counted by the URL-scanner ban.
- Full GET sweep (185 routes, admin + user), fuzz and regression: 0 errors.

## v21.112 — Classic UI is the default again
- Black + Platinum is back as the default look. The Cyber-HUD skin is opt-in via the "HUD" button in the top bar.

## v21.113 — App Studio (Replit-style apps + AI builder)
- New app type **App Studio** (Admin → Web plans → Engine "App Studio", or Admin → Create server → App). Each app is a Docker container with Python 3.12 + Node 22 and a live https address.
- Studio page (`/vm/<id>/studio`): file tree, code editor (Tab, Ctrl+S, line numbers), Run/Stop, editable run command, live console, starter templates (Flask, Express, static HTML, Python script).
- **AI builder** (right panel): uses the key from Admin → AI Assistant. The AI lists/reads/writes/edits files, sets the run command, restarts the app and reads the logs to check its work. Limits: 30 requests/hour per user, never reads `.env`, cannot leave the project folder, **Undo** reverts the last AI turn.
- `requirements.txt` / `package.json` are installed automatically on every Run (no root, no apt). Apps stop after repeated crashes (restart on-failure x5).
- Not included: syntax colours in the editor (plain editor), AI streaming.

## v21.114 — App Studio fixes
- Expired apps can no longer be started/restarted from Studio or by the AI (renew first).
- Template apply no longer walks the whole project (node_modules) — only the starter files are touched.
- Studio page: a JS variable named `open` no longer shadows the browser's `window.open`.

## v21.115 — Cleaner UI (fewer buttons)
- Dashboard server rows: one main button (Open / Manage / Terminal) + a "⋯" menu for Details, Files, Domains (was 2-3 buttons per row).
- Sidebar: 6 main links; the rest (Shared, Orders, Invite, Receipts, Templates, Achievements, Server list, All apps, API, What's new, Activity) are in a "More" fold that opens automatically on those pages.
- Top bar: the HUD button and the old language button are gone; the look switch is now in the profile menu (Look: Classic/HUD). The language picker stays.
