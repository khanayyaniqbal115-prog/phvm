# core_upgrades.py - optional security helpers (opt-in; nothing here changes behaviour until you use it)
import os
import hmac
import hashlib
import json
import urllib.request
from functools import wraps
from flask import request, jsonify

# Remote license check: only used when LICENSE_VERIFY_URL is set. Without it, verify_remote_license() says "not configured".
LICENSE_VERIFY_URL = os.getenv("LICENSE_VERIFY_URL", "").strip()
# Shared secret for panel <-> node signatures. Set a long random value in /etc/phvm.env on the panel AND on every node.
NODE_CLUSTER_SECRET = os.getenv("NODE_CLUSTER_SECRET", "").strip()


def verify_remote_license(license_key, domain):
    """Ask YOUR license server whether a key is valid. Returns {'valid': bool, 'reason': str}."""
    if not LICENSE_VERIFY_URL:
        return {"valid": False, "reason": "LICENSE_VERIFY_URL not configured"}
    try:
        body = json.dumps({"license_key": license_key, "domain": domain}).encode()
        req = urllib.request.Request(LICENSE_VERIFY_URL, data=body, method="POST", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=6) as r:
            return json.loads(r.read().decode())
    except Exception as exc:
        return {"valid": False, "reason": str(exc)[:200]}


def sign_payload(payload: bytes) -> str:
    return hmac.new(NODE_CLUSTER_SECRET.encode(), payload, hashlib.sha256).hexdigest()


def require_node_signature(f):
    """Protect a route with an HMAC-SHA256 signature of the raw body in header X-PHVM-Signature.
    Refuses everything while NODE_CLUSTER_SECRET is unset (no default secret exists)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not NODE_CLUSTER_SECRET:
            return jsonify({"error": "NODE_CLUSTER_SECRET not configured"}), 503
        sig = request.headers.get("X-PHVM-Signature", "")
        if not hmac.compare_digest(sig, sign_payload(request.get_data())):
            return jsonify({"error": "Unauthorized node signature"}), 403
        return f(*args, **kwargs)
    return decorated


def init_security_upgrades(app):
    def page(code, title, msg):
        html = ('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                '<title>%s</title><body style="background:#050811;color:#e2f1ff;font-family:monospace;display:flex;min-height:100vh;'
                'align-items:center;justify-content:center;text-align:center"><div><h1 style="color:#00f0ff">%s</h1><p>%s</p></div>'
                % (title, code, msg))
        return html

    @app.errorhandler(403)
    def _forbidden(e):
        return page(403, 'Access denied', 'Access Denied / Ijazat Nahi Hai'), 403

    @app.errorhandler(429)
    def _ratelimit(e):
        return page(429, 'Too many requests', 'DDoS Shield Active: Thora intezar karein'), 429
