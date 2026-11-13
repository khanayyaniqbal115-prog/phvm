#!/usr/bin/env bash
# PHvm Panel — one-shot HTTPS setup.
# Puts Nginx in front of the panel (port 5050) and gets a free Let's Encrypt
# certificate, so the panel is reachable at https://yourdomain instead of
# http://ip:5050.
#
# Usage:
#   sudo bash setup_https.sh yourdomain.example.com [panel_port]
#
# Requirements:
#   - A domain (or subdomain) already pointed (A record) at this server's IP
#   - Run as root / with sudo
#   - Ubuntu/Debian (apt-based)

set -e

DOMAIN="$1"
PORT="${2:-${PHVM_PORT:-5050}}"

if [ -z "$DOMAIN" ]; then
    echo "Usage: sudo bash setup_https.sh yourdomain.example.com [panel_port]"
    echo "Example: sudo bash setup_https.sh test.akvmpanel.dpdns.org 5050"
    exit 1
fi

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo bash setup_https.sh $DOMAIN $PORT"
    exit 1
fi

echo "==> Installing nginx + certbot..."
apt update -qq
apt install -y -qq nginx certbot python3-certbot-nginx

echo "==> Writing nginx config for $DOMAIN -> 127.0.0.1:$PORT ..."
cat > /etc/nginx/sites-available/phvm <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/phvm /etc/nginx/sites-enabled/phvm
rm -f /etc/nginx/sites-enabled/default

echo "==> Testing nginx config..."
nginx -t

echo "==> Restarting nginx..."
systemctl restart nginx
systemctl enable nginx

echo "==> Requesting Let's Encrypt certificate for ${DOMAIN} ..."
certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --redirect \
    -m "admin@${DOMAIN}" --no-eff-email || {
    echo ""
    echo "!! certbot failed. Common causes:"
    echo "   - DNS for ${DOMAIN} isn't pointing at this server's IP yet"
    echo "   - Port 80 is blocked by a firewall/security group"
    echo "   Fix that, then re-run: certbot --nginx -d ${DOMAIN}"
    exit 1
}

echo "==> Setting up auto-renewal (certbot installs a systemd timer/cron by default) ..."
systemctl list-timers | grep -i certbot || echo "  (certbot renew timer should already be active — check: systemctl list-timers)"

echo ""
echo "================================================================"
echo "  Done! Your panel should now be reachable at:"
echo "    https://${DOMAIN}"
echo ""
echo "  Next steps:"
echo "  1. In your firewall/security group, close direct access to port ${PORT}"
echo "     from the internet — only nginx (80/443) should be public."
echo "  2. Restart the panel service if it isn't already running:"
echo "     e.g. systemctl restart phvm   (or however you start phvm.py)"
echo "================================================================"
