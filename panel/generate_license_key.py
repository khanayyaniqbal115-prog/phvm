#!/usr/bin/env python3
"""
Run this ON YOUR SERVER, in the same folder as phvm.py, to see (or generate)
the one valid license key for THIS install. Each install has its own unique
key — this only works for the machine it's run on.

Usage:
    cd /opt/phvm      # or wherever phvm.py lives
    python3 generate_license_key.py
"""
import sqlite3
import hmac
import hashlib
import secrets
import os

DB_PATH = "phvm.db"
LICENSE_SECRET = "phvm-9f3c7a1e-59b2-4d8a-b6ce-2f0a7e4c1d6b-do-not-share"


def get_setting(conn, key, default=""):
    row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return row[0] if row else default


def set_setting(conn, key, value):
    conn.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?,?,CURRENT_TIMESTAMP) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP",
        (key, value),
    )
    conn.commit()


def expected_key(install_id: str) -> str:
    digest = hmac.new(LICENSE_SECRET.encode(), install_id.encode(), hashlib.sha256).hexdigest()
    chunks = [digest[i:i+5].upper() for i in range(0, 20, 5)]
    return "PHvm-" + "-".join(chunks)


def main():
    if not os.path.exists(DB_PATH):
        print(f"Couldn't find {DB_PATH} in this folder — run this from your PHvm install directory.")
        return

    conn = sqlite3.connect(DB_PATH)
    install_id = get_setting(conn, "license_install_id", "")
    if not install_id:
        install_id = secrets.token_hex(16)
        set_setting(conn, "license_install_id", install_id)
        print("(No install ID existed yet — generated a new one for this server.)")

    key = expected_key(install_id)
    print("")
    print("=" * 50)
    print(f"  Install ID:   {install_id}")
    print(f"  License Key:  {key}")
    print("=" * 50)
    print("")
    print("This key is unique to THIS server only — it won't work on any other install.")


if __name__ == "__main__":
    main()
