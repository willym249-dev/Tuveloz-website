"""Owner-PC outbound scan runner. It opens no ports and retains no file bytes.

Run once from an owner-controlled scheduled task. The website owns the durable
queue; an interrupted/offline runner leaves jobs quarantined for later retry.
"""
from __future__ import annotations

import argparse
import ctypes
from ctypes import wintypes
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

POLICY_VERSION = "tuveloz-static-documents-v1"
PATH = "/api/internal/self-hosted-scans"
MAX_IMAGE_BYTES = 8 * 1024 * 1024
SHA = re.compile(r"^[a-f0-9]{64}$")
SIGNATURE_VOLUME = "tuveloz-clamav-signatures-v1"
OFFICIAL_IMAGE = "clamav/clamav@sha256:c6fc61da368cee0df3d78a79855fee4e76db7988d9dbbc434f5e1d1d24867b8a"


class ScannerUnavailable(RuntimeError):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise ScannerUnavailable("redirect_refused")


def validate_origin(origin: str, allow_loopback=False) -> str:
    parsed = urllib.parse.urlsplit(origin)
    normal = parsed.scheme == "https" and parsed.hostname == "tuveloz.com" and parsed.port in (None, 443)
    loopback = allow_loopback and parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "::1"}
    if not (normal or loopback) or parsed.username or parsed.password or parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise ValueError("scanner_origin_not_allowed")
    return origin.rstrip("/")


def request_signature(secret: str, timestamp: str, body: bytes) -> str:
    message = f"v1.POST.{PATH}.{timestamp}.".encode() + body
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def protected_secret(path: Path) -> str:
    if os.name != "nt":
        raise ScannerUnavailable("owner_credential_requires_windows_dpapi")
    encrypted = path.read_bytes()
    if not 1 <= len(encrypted) <= 8192:
        raise ScannerUnavailable("invalid_protected_credential")
    class Blob(ctypes.Structure):
        _fields_ = [("size", wintypes.DWORD), ("data", ctypes.POINTER(ctypes.c_ubyte))]
    buffer = (ctypes.c_ubyte * len(encrypted)).from_buffer_copy(encrypted)
    original = Blob(len(encrypted), buffer)
    plain = Blob()
    crypt = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    crypt.CryptUnprotectData.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p,
                                        ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    crypt.CryptUnprotectData.restype = wintypes.BOOL
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    if not crypt.CryptUnprotectData(ctypes.byref(original), None, None, None, None, 1, ctypes.byref(plain)):
        raise ScannerUnavailable("credential_could_not_be_decrypted")
    try:
        secret = ctypes.string_at(plain.data, plain.size).decode("ascii")
    finally:
        ctypes.memset(plain.data, 0, plain.size)
        kernel.LocalFree(plain.data)
    if not re.fullmatch(r"[a-f0-9]{64}", secret):
        raise ScannerUnavailable("invalid_scanner_credential")
    return secret


def docker(arguments, data=None, timeout=180):
    return subprocess.run(["wsl.exe", "-d", "Ubuntu", "-u", "root", "--exec", "docker", *arguments],
                          input=data, capture_output=True, timeout=timeout, check=False)


def scan_in_container(job: dict, data: bytes, image: str, *, execute=docker) -> dict:
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", image):
        raise ValueError("unpinned_scanner_image")
    name = "tuveloz-private-scan-" + uuid.uuid4().hex
    arguments = ["run", "--rm", "--name", name, "--no-healthcheck", "-i", "--network", "none",
        "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--user", "clamav",
        "--memory", "4g", "--cpus", "1", "--pids-limit", "96",
        "--tmpfs", "/tmp:rw,noexec,nosuid,size=256m,mode=1777",
        "--mount", f"type=volume,source={SIGNATURE_VOLUME},target=/var/lib/clamav,readonly",
        image, job["kind"], job["contentType"], job["fileHash"]]
    try:
        result = execute(arguments, data=data, timeout=180)
    except subprocess.TimeoutExpired as error:
        execute(["stop", "--time", "2", name], timeout=15)
        raise ScannerUnavailable("scanner_timeout") from error
    if result.returncode or result.stderr.strip() or not 1 <= len(result.stdout) <= 12_000:
        raise ScannerUnavailable("scanner_did_not_return_a_verdict")
    receipt = json.loads(result.stdout)
    if not isinstance(receipt, dict) or receipt.get("fileHash") != job["fileHash"] or receipt.get("policyVersion") != POLICY_VERSION:
        raise ScannerUnavailable("scanner_receipt_does_not_match")
    return receipt


def validate_job(job):
    if not isinstance(job, dict) or not re.fullmatch(r"[a-f0-9-]{36}", str(job.get("id", ""))):
        raise ScannerUnavailable("invalid_job")
    kind, content_type = job.get("kind"), job.get("contentType")
    types = {"image/jpeg", "image/png", "image/webp"}
    if kind == "evidence":
        types.add("application/pdf")
    maximum = 3_500_000 if kind == "evidence" else MAX_IMAGE_BYTES
    if (kind not in {"evidence", "message"} or content_type not in types
            or job.get("policyVersion") != POLICY_VERSION
            or not SHA.fullmatch(str(job.get("fileHash", "")))
            or type(job.get("byteSize")) is not int or not 1 <= job["byteSize"] <= maximum):
        raise ScannerUnavailable("invalid_job")
    return job


class Client:
    def __init__(self, origin: str, secret: str, *, allow_loopback=False):
        self.origin = validate_origin(origin, allow_loopback)
        if len(secret) < 32:
            raise ValueError("missing_scanner_secret")
        self.secret = secret
        # Honor neither proxy environment variables nor redirects for file bytes
        # and scanner credentials. HTTPS uses the platform's certificate checks.
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def post(self, body: dict, *, binary=False, max_bytes=12_000):
        raw = json.dumps(body, sort_keys=True, separators=(",", ":")).encode()
        timestamp = str(int(time.time()))
        request = urllib.request.Request(self.origin + PATH, data=raw, method="POST", headers={
            "Content-Type": "application/json", "x-tuveloz-scan-timestamp": timestamp,
            "x-tuveloz-scan-signature": request_signature(self.secret, timestamp, raw),
        })
        deadline = time.monotonic() + 60
        with self.opener.open(request, timeout=20) as response:
            if response.status != 200:
                raise ScannerUnavailable("unexpected_http_status")
            declared = response.headers.get("content-length")
            if declared is not None and (not declared.isdigit() or int(declared) > max_bytes):
                raise ScannerUnavailable("response_too_large")
            chunks, total = [], 0
            while True:
                if time.monotonic() > deadline:
                    raise ScannerUnavailable("response_timeout")
                chunk = response.read(min(65536, max_bytes + 1 - total))
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise ScannerUnavailable("response_too_large")
                chunks.append(chunk)
            if time.monotonic() > deadline:
                raise ScannerUnavailable("response_timeout")
        value = b"".join(chunks)
        return value if binary else json.loads(value)

    def run_once(self, image: str, *, limit=3, scan=scan_in_container):
        result = {"claimed": 0, "recorded": 0, "retryable": 0, "unavailable": 0}
        for _ in range(max(1, min(3, limit))):
            try:
                answer = self.post({"action": "claim"})
                if not isinstance(answer, dict) or "job" not in answer:
                    raise ScannerUnavailable("invalid_claim_response")
                if answer["job"] is None:
                    break
                job = validate_job(answer["job"])
                result["claimed"] += 1
                data = self.post({"action": "file", "id": job["id"]}, binary=True, max_bytes=job["byteSize"])
                if len(data) != job["byteSize"] or hashlib.sha256(data).hexdigest() != job["fileHash"]:
                    raise ScannerUnavailable("download_hash_mismatch")
                receipt = scan(job, data, image)
                # The same immutable receipt is safe to retry after a lost reply.
                payload = {"action": "result", "id": job["id"], "receipt": receipt}
                try:
                    recorded = self.post(payload)
                except (OSError, urllib.error.URLError):
                    recorded = self.post(payload)
                if not isinstance(recorded, dict) or recorded.get("accepted") is not True:
                    raise ScannerUnavailable("result_not_acknowledged")
                key = "retryable" if recorded.get("retry") is True else "recorded"
                result[key] += 1
            except (Exception, MemoryError):
                # No false clean result, no file retained and no provider email.
                result["unavailable"] += 1
                break
        return result


def update_signatures(state_dir: Path):
    stamp = state_dir / "signatures-updated.json"
    try:
        previous = json.loads(stamp.read_text())["time"]
        if 0 <= time.time() - previous < 4 * 3600:
            return
    except (OSError, ValueError, KeyError, TypeError):
        pass
    # Only the official updater has network access. It receives no file bytes,
    # scan jobs or credentials. The persistent volume was created during setup.
    name = "tuveloz-definition-update-" + uuid.uuid4().hex
    command = ["run", "--rm", "--name", name, "--no-healthcheck", "--read-only", "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges", "--user", "clamav", "--memory", "4g", "--cpus", "1",
        "--pids-limit", "96", "--tmpfs", "/tmp:rw,noexec,nosuid,size=256m,mode=1777",
        "--mount", f"type=volume,source={SIGNATURE_VOLUME},target=/var/lib/clamav",
        "--entrypoint", "/bin/sh", OFFICIAL_IMAGE, "-c",
        "printf '%s\\n' 'DatabaseMirror database.clamav.net' 'DatabaseOwner clamav' 'DatabaseDirectory /var/lib/clamav' > /tmp/freshclam.conf\n"
        "exec freshclam --config-file=/tmp/freshclam.conf --stdout"]
    try:
        result = docker(command, timeout=300)
    except subprocess.TimeoutExpired:
        docker(["stop", "--time", "2", name], timeout=15)
        raise ScannerUnavailable("signature_update_timeout")
    if result.returncode:
        raise ScannerUnavailable("signature_update_failed")
    stamp.write_text(json.dumps({"time": time.time()}) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--secret-file", type=Path, required=True)
    parser.add_argument("--image-file", type=Path, required=True)
    parser.add_argument("--state-dir", type=Path, required=True)
    parser.add_argument("--origin", default="https://tuveloz.com")
    parser.add_argument("--update-signatures", action="store_true")
    args = parser.parse_args()
    validate_origin(args.origin)
    args.state_dir.mkdir(parents=True, exist_ok=True)
    try:
        if args.update_signatures:
            update_signatures(args.state_dir)
        image = json.loads(args.image_file.read_text())["image"]
        result = Client(args.origin, protected_secret(args.secret_file)).run_once(image)
    except Exception:
        result = {"claimed": 0, "recorded": 0, "retryable": 0, "unavailable": 1}
    result["checkedAt"] = time.time()
    (args.state_dir / "last-run.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result), flush=True)
    raise SystemExit(1 if result["unavailable"] else 0)
