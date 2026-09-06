"""One bounded offline scan; JSON verdict on stdout, no original file retained."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile

from document_policy import EVIDENCE_MAX_BYTES, IMAGE_MAX_BYTES, POLICY_VERSION, PolicyRejected, inspect_document


def fresh_engine(version: str, now: datetime) -> tuple[str, str]:
    match = re.fullmatch(r"ClamAV (\d+\.\d+\.\d+)/(\d+)/(.+)", version.strip())
    if not match:
        raise ValueError("invalid_engine_version")
    date = datetime.strptime(match.group(3), "%a %b %d %H:%M:%S %Y").replace(tzinfo=timezone.utc)
    if not -300 <= (now - date).total_seconds() <= 72 * 3600:
        raise ValueError("stale_signatures")
    return f"ClamAV {match.group(1)}/{match.group(2)}", date.isoformat()


def scan(data: bytes, kind: str, content_type: str, expected_hash: str, *, execute=subprocess.run) -> dict:
    now = datetime.now(timezone.utc)
    digest = hashlib.sha256(data).hexdigest()
    result = {"status": "error", "fileHash": digest, "policyVersion": POLICY_VERSION,
              "policyPassed": False, "antivirusPassed": False, "scannedAt": now.isoformat(),
              "engineVersion": "", "signatureDate": "", "reason": "not_scanned"}
    maximum = EVIDENCE_MAX_BYTES if kind == "evidence" else IMAGE_MAX_BYTES
    if kind not in {"evidence", "message"} or not data or len(data) > maximum or digest != expected_hash:
        return {**result, "reason": "file_integrity"}
    try:
        version = execute(["clamscan", "--version"], capture_output=True, text=True, timeout=10, check=False)
        if version.returncode or version.stderr.strip():
            raise ValueError("engine_unavailable")
        result["engineVersion"], result["signatureDate"] = fresh_engine(version.stdout, now)
        with tempfile.TemporaryDirectory(prefix="tuveloz-scan-") as directory:
            path = Path(directory) / "document"
            path.write_bytes(data)
            command = ["clamscan", "--database=/var/lib/clamav", "--fail-if-cvd-older-than=3",
                       "--official-db-only=yes", "--disable-cache", "--heuristic-alerts=yes",
                       "--alert-encrypted=yes", "--alert-macros=yes", "--alert-broken=yes",
                       "--alert-broken-media=yes", "--alert-exceeds-max=yes", f"--max-filesize={maximum}",
                       "--max-scansize=64M", "--max-files=100", "--max-recursion=10",
                       "--pcre-max-filesize=64M", "--max-scantime=0", f"--tempdir={directory}", str(path)]
            verdict = execute(command, capture_output=True, text=True, timeout=90, check=False)
            if verdict.returncode == 1 and " FOUND" in verdict.stdout:
                detections = re.findall(r"^.+: (.+) FOUND$", verdict.stdout, re.MULTILINE)
                if detections and all(name.startswith(("Heuristics.Encrypted.", "Heuristics.Broken.")) for name in detections):
                    return {**result, "status": "failed", "reason": "document_cannot_be_inspected"}
                return {**result, "status": "infected", "reason": "antivirus_detection"}
            # Size/decoding limits can return code 2, even with a FOUND marker.
            # Any error, warning or incomplete result keeps quarantine in place.
            if (verdict.returncode != 0 or verdict.stderr.strip() or "WARNING" in verdict.stdout
                    or "ERROR" in verdict.stdout or " FOUND" in verdict.stdout
                    or f"{path}: OK" not in verdict.stdout
                    or not re.search(r"^Scanned files:\s+1$", verdict.stdout, re.MULTILINE)
                    or not re.search(r"^Infected files:\s+0$", verdict.stdout, re.MULTILINE)):
                raise ValueError("antivirus_incomplete")
        result["antivirusPassed"] = True
        inspect_document(data, kind, content_type)
        return {**result, "status": "clean", "policyPassed": True, "reason": "checks_passed"}
    except PolicyRejected as error:
        return {**result, "status": "failed", "reason": str(error)}
    except (Exception, MemoryError):
        return {**result, "reason": "scan_unavailable"}


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("Expected kind, content type and SHA-256.")
    raw = sys.stdin.buffer.read(IMAGE_MAX_BYTES + 1)
    receipt = scan(raw, *sys.argv[1:])
    receipt["reportHash"] = hashlib.sha256(json.dumps(receipt, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    print(json.dumps(receipt, sort_keys=True, separators=(",", ":")), flush=True)
