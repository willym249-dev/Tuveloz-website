"""Synthetic parser and fail-closed regressions; no external requests."""
import sys
sys.path.insert(0, "/opt/tuveloz")

from datetime import datetime, timedelta, timezone
import hashlib
import io
import struct
import subprocess
import unittest
import zlib

from PIL import Image
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, TextStringObject

from document_policy import PolicyRejected, check_action, inspect_document, inspect_metadata
from scan_file import fresh_engine, scan
from runner import Client, ScannerUnavailable, scan_in_container, validate_origin


def make_pdf(pages=2, action=False, attachment=False, password=False):
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=612, height=792)
    if action:
        writer.add_js("void 0;")
    if attachment:
        writer.add_attachment("plain.txt", b"Synthetic attachment")
    if password:
        writer.encrypt("synthetic-test-password")
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def make_raw_script_pdf(escaped=False, compressed=False):
    action = b"<< /S /JavaScript " + (b"/J#53" if escaped else b"/JS") + b" (void 0;) >>"
    objects = {1: b"<< /Type /Catalog /Pages 2 0 R /OpenAction 5 0 R >>",
               2: b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
               3: b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",
               4: b"<< /Length 0 >>\nstream\n\nendstream"}
    if compressed:
        packed = zlib.compress(b"5 0 " + action)
        objects[6] = b"<< /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length " + str(len(packed)).encode() + b" >>\nstream\n" + packed + b"\nendstream"
    else:
        objects[5] = action
    raw = bytearray(b"%PDF-1.5\n")
    offsets = {}
    for number, body in objects.items():
        offsets[number] = len(raw)
        raw.extend(f"{number} 0 obj\n".encode() + body + b"\nendobj\n")
    start = len(raw)
    if compressed:
        offsets[7] = start
        entries = []
        for number in range(8):
            values = (0, 0, 65535) if number == 0 else (2, 6, 0) if number == 5 else (1, offsets[number], 0)
            entries.append(struct.pack(">BIH", *values))
        packed = zlib.compress(b"".join(entries))
        raw.extend(b"7 0 obj\n<< /Type /XRef /Size 8 /Root 1 0 R /W [1 4 2] /Filter /FlateDecode /Length "
                   + str(len(packed)).encode() + b" >>\nstream\n" + packed + b"\nendstream\nendobj\n")
    else:
        raw.extend(b"xref\n0 6\n0000000000 65535 f \n")
        for number in range(1, 6):
            raw.extend(f"{offsets[number]:010d} 00000 n \n".encode())
        raw.extend(b"trailer\n<< /Size 6 /Root 1 0 R >>\n")
    raw.extend(f"startxref\n{start}\n%%EOF\n".encode())
    return bytes(raw)


def make_image(format="PNG", animated=False):
    output = io.BytesIO()
    image = Image.new("RGB", (160, 90), (22, 81, 115))
    options = {"save_all": True, "append_images": [Image.new("RGB", (160, 90), "white")]} if animated else {}
    image.save(output, format=format, **options)
    return output.getvalue()


class DocumentTests(unittest.TestCase):
    def test_normal_web_links_work_but_script_and_local_file_links_do_not(self):
        check_action(DictionaryObject({NameObject("/S"): NameObject("/URI"), NameObject("/URI"): TextStringObject("https://example.com/insurance")}))
        for uri in ("javascript:void(0)", "file:///private", "https://user:password@example.com", "https://example.com/\nunsafe"):
            with self.subTest(uri=uri), self.assertRaises(PolicyRejected):
                check_action(DictionaryObject({NameObject("/S"): NameObject("/URI"), NameObject("/URI"): TextStringObject(uri)}))

    def test_xml_entities_are_rejected_in_utf8_and_utf16_metadata(self):
        inspect_metadata(b"<metadata>Plain text</metadata>")
        xml = '<!DOCTYPE x [<!ENTITY y SYSTEM "file:///private">]><x>&y;</x>'
        for encoding in ("utf-8", "utf-16"):
            with self.subTest(encoding=encoding), self.assertRaises(PolicyRejected):
                inspect_metadata(xml.encode(encoding))

    def test_static_pdf_keeps_every_page_and_bytes(self):
        data = make_pdf()
        before = hashlib.sha256(data).digest()
        self.assertEqual(inspect_document(data, "evidence", "application/pdf")["pages"], 2)
        self.assertEqual(hashlib.sha256(data).digest(), before)

    def test_javascript_names_actions_and_compressed_objects_are_blocked(self):
        for data in (make_pdf(action=True), make_raw_script_pdf(), make_raw_script_pdf(escaped=True), make_raw_script_pdf(compressed=True)):
            with self.subTest(digest=hashlib.sha256(data).hexdigest()), self.assertRaises(PolicyRejected):
                inspect_document(data, "evidence", "application/pdf")

    def test_encryption_attachments_and_excessive_pages_are_blocked(self):
        for data in (make_pdf(password=True), make_pdf(attachment=True), make_pdf(pages=201)):
            with self.subTest(digest=hashlib.sha256(data).hexdigest()), self.assertRaises(PolicyRejected):
                inspect_document(data, "evidence", "application/pdf")

    def test_parser_errors_truncation_and_unexpected_file_type_are_blocked(self):
        for data, mime in ((make_pdf()[:-10], "application/pdf"), (b"%PDF-1.5\nbroken\n%%EOF", "application/pdf"),
                           (b"<script>void 0;</script>", "image/png"), (make_image(), "image/jpeg")):
            with self.subTest(mime=mime), self.assertRaises(PolicyRejected):
                inspect_document(data, "evidence", mime)

    def test_normal_supported_images_are_decoded_without_rewriting(self):
        for format, mime in (("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")):
            with self.subTest(format=format):
                data = make_image(format)
                original = bytes(data)
                self.assertEqual(inspect_document(data, "message", mime)["format"], format)
                self.assertEqual(data, original)

    def test_truncated_and_animated_images_are_blocked(self):
        for data, mime in ((make_image()[:-14], "image/png"), (make_image("WEBP", animated=True), "image/webp")):
            with self.subTest(mime=mime), self.assertRaises(PolicyRejected):
                inspect_document(data, "message", mime)

    def test_evidence_size_boundary_and_message_pdf_prohibition(self):
        data = make_pdf()
        padded = data + b" " * (3_500_000 - len(data))
        self.assertTrue(inspect_document(padded, "evidence", "application/pdf")["policyPassed"])
        for data, kind in ((padded + b" ", "evidence"), (make_pdf(), "message"), (b"", "evidence")):
            with self.subTest(kind=kind), self.assertRaises(PolicyRejected):
                inspect_document(data, kind, "application/pdf")


class VerdictTests(unittest.TestCase):
    def fake_engine(self, mode="clean"):
        def execute(command, **kwargs):
            if command[-1] == "--version":
                age = 5 if mode == "stale" else 0
                date = (datetime.now(timezone.utc) - timedelta(days=age)).strftime("%a %b %d %H:%M:%S %Y")
                return subprocess.CompletedProcess(command, 0, f"ClamAV 1.5.4/28114/{date}\n", "")
            if mode == "timeout":
                raise subprocess.TimeoutExpired(command, 90)
            path = command[-1]
            if mode == "infected":
                return subprocess.CompletedProcess(command, 1, f"{path}: Eicar-Test-Signature FOUND\n", "")
            if mode == "encrypted":
                return subprocess.CompletedProcess(command, 1, f"{path}: Heuristics.Encrypted.PDF FOUND\n", "")
            if mode == "limit":
                return subprocess.CompletedProcess(command, 2, f"{path}: Heuristics.Limits.Exceeded.MaxFileSize FOUND\n", "")
            output = f"{path}: OK\nScanned files: 1\nInfected files: 0\n"
            if mode == "empty":
                output = ""
            return subprocess.CompletedProcess(command, 0, output, "WARNING: parser problem" if mode == "warning" else "")
        return execute

    def run_sample(self, mode="clean", data=None):
        data = make_pdf() if data is None else data
        return scan(data, "evidence", "application/pdf", hashlib.sha256(data).hexdigest(), execute=self.fake_engine(mode))

    def test_antivirus_clean_is_insufficient_for_active_pdf(self):
        result = self.run_sample(data=make_pdf(action=True))
        self.assertEqual(result["status"], "failed")
        self.assertTrue(result["antivirusPassed"])
        self.assertFalse(result["policyPassed"])

    def test_only_complete_antivirus_and_policy_checks_are_clean(self):
        result = self.run_sample()
        self.assertEqual(result["status"], "clean")
        self.assertTrue(result["antivirusPassed"] and result["policyPassed"])

    def test_timeout_limits_warnings_missing_output_and_old_definitions_never_clean(self):
        for mode in ("timeout", "limit", "warning", "empty", "stale"):
            with self.subTest(mode=mode):
                self.assertEqual(self.run_sample(mode)["status"], "error")

    def test_detected_threat_is_not_clean(self):
        self.assertEqual(self.run_sample("infected")["status"], "infected")

    def test_password_restriction_is_not_reported_as_a_virus(self):
        result = self.run_sample("encrypted", make_pdf(password=True))
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["reason"], "document_cannot_be_inspected")
        self.assertFalse(result["antivirusPassed"] or result["policyPassed"])

    def test_changed_file_is_never_sent_to_engine(self):
        def forbidden(*args, **kwargs):
            self.fail("Engine must not run after a hash mismatch")
        self.assertEqual(scan(make_pdf(), "evidence", "application/pdf", "0" * 64, execute=forbidden)["status"], "error")

    def test_future_or_missing_signature_dates_fail(self):
        now = datetime.now(timezone.utc)
        for version in ("ClamAV 1.5.4", "ClamAV 1.5.4/28114/" + (now + timedelta(days=1)).strftime("%a %b %d %H:%M:%S %Y")):
            with self.assertRaises(ValueError):
                fresh_engine(version, now)


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.data = b"synthetic queued document"
        self.job = {"id": "a" * 36, "kind": "evidence", "contentType": "application/pdf",
                    "byteSize": len(self.data), "fileHash": hashlib.sha256(self.data).hexdigest(),
                    "policyVersion": "tuveloz-static-documents-v1"}
        self.client = Client("http://127.0.0.1:12345", "synthetic-secret-" * 4, allow_loopback=True)

    def test_credentials_cannot_be_sent_to_another_site_or_plain_http(self):
        for origin in ("https://tuveloz.com.attacker.example", "https://tuveloz.com@attacker.example",
                       "http://tuveloz.com", "https://tuveloz.com/path", "http://127.0.0.1:12345"):
            with self.subTest(origin=origin), self.assertRaises(ValueError):
                validate_origin(origin)

    def test_disconnected_runner_never_invokes_scanner_or_submits_a_result(self):
        def unavailable(*args, **kwargs):
            raise OSError("offline")
        self.client.post = unavailable
        result = self.client.run_once("sha256:" + "a" * 64, scan=lambda *args: self.fail("No job to scan"))
        self.assertEqual(result, {"claimed": 0, "recorded": 0, "retryable": 0, "unavailable": 1})

    def test_changed_download_never_reaches_scanner(self):
        def post(body, **kwargs):
            return {"job": self.job} if body["action"] == "claim" else b"changed"
        self.client.post = post
        result = self.client.run_once("sha256:" + "a" * 64, scan=lambda *args: self.fail("Changed file must not scan"))
        self.assertEqual(result["recorded"], 0)
        self.assertEqual(result["unavailable"], 1)

    def test_lost_result_reply_retries_the_identical_receipt(self):
        results = []
        receipt = {"status": "clean", "fileHash": self.job["fileHash"], "policyVersion": self.job["policyVersion"]}
        def post(body, **kwargs):
            if body["action"] == "claim":
                return {"job": self.job}
            if body["action"] == "file":
                return self.data
            results.append(body)
            if len(results) == 1:
                raise OSError("reply was lost")
            return {"accepted": True, "duplicate": True}
        self.client.post = post
        result = self.client.run_once("sha256:" + "a" * 64, limit=1, scan=lambda *args: receipt)
        self.assertEqual(result["recorded"], 1)
        self.assertEqual(results[0], results[1])

    def test_timed_out_container_is_stopped_by_its_own_unique_name(self):
        commands = []
        def execute(arguments, **kwargs):
            commands.append(arguments)
            if arguments[0] == "run":
                raise subprocess.TimeoutExpired(arguments, 180)
            return subprocess.CompletedProcess(arguments, 0, b"", b"")
        with self.assertRaises(ScannerUnavailable):
            scan_in_container(self.job, self.data, "sha256:" + "a" * 64, execute=execute)
        run = commands[0]
        self.assertEqual(run[run.index("--network") + 1], "none")
        self.assertIn("--read-only", run)
        self.assertEqual(commands[1], ["stop", "--time", "2", run[run.index("--name") + 1]])

    def test_empty_queue_finishes_without_scanning(self):
        self.client.post = lambda *args, **kwargs: {"job": None}
        self.assertEqual(self.client.run_once("sha256:" + "a" * 64, scan=lambda *args: self.fail("Empty queue"))["claimed"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
