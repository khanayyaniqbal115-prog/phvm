#!/usr/bin/env bash
# upgrade_cleanup.sh - moves the license generator/server OUT of the client panel folder (keep them private).
set -e
cd "$(dirname "$0")"
mkdir -p ../phvm_private_license_backup
for f in license_server.py generate_license_key.py; do
  if [ -f "$f" ]; then mv "$f" ../phvm_private_license_backup/ && echo "[OK] $f moved to ../phvm_private_license_backup/"; fi
done
# NOTE: static/uploads/sidebar-icon.png is NOT removed - the panel uses it (sidebar logo + PDF invoices).
echo "[DONE] Restart the panel: bash restart.sh"
