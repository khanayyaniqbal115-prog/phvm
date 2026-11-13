#!/usr/bin/env bash
# Restarts PHvm Panel without systemd — for containers/sandboxes where
# `systemctl` isn't available (e.g. "systemd is not running in this container").
#
# Usage:
#   bash restart.sh
#
set -e
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "Stopping any running phvm.py process..."
pkill -f "python.*phvm\.py" 2>/dev/null || true
sleep 1

if [ -d venv ]; then
    source venv/bin/activate
fi

echo "Installing/updating dependencies..."
pip install -r requirements.txt --quiet --break-system-packages 2>/dev/null || pip install -r requirements.txt --quiet

echo "Starting PHvm Panel in the background..."
nohup python3 phvm.py > phvm.log 2>&1 &
disown

sleep 2
echo ""
echo "Started. Tail logs with:  tail -f phvm.log"
echo "Stop it again with:       pkill -f 'python.*phvm.py'"
