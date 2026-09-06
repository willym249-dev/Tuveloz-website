"""Static document policy. Run only in the isolated, network-disabled scanner.

The original file is inspected, never rewritten. This is not authenticity,
insurance or licensing verification. Resource/time limits belong to the caller.
"""
from __future__ import annotations

import io
import logging
import warnings
from urllib.parse import urlsplit
from xml.parsers import expat

from PIL import Image, ImageFile
from pypdf import PdfReader, filters
from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject, NameObject, StreamObject

POLICY_VERSION = "tuveloz-static-documents-v1"
EVIDENCE_MAX_BYTES = 3_500_000
IMAGE_MAX_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 50_000_000
MAX_PDF_OBJECTS = 20_000
MAX_DECODED_BYTES = 64 * 1024 * 1024
TYPES = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}

# Ordinary page navigation and web links remain usable. Automatic actions,
# scripts, files, dynamic forms and multimedia require a plain issuer copy.
BLOCKED_KEYS = {
    "/JS", "/JavaScript", "/AA", "/XFA", "/EF", "/EmbeddedFiles",
    "/RichMediaContent", "/RichMediaSettings", "/3DD", "/3DA", "/AF", "/Collection",
    "/SubmitForm", "/ImportData", "/Launch", "/GoToR", "/GoToE",
}
BLOCKED_NAMES = {
    "/JavaScript", "/EmbeddedFile", "/Filespec", "/Launch", "/GoToR", "/GoToE",
    "/SubmitForm", "/ImportData", "/Rendition", "/Movie", "/Sound",
    "/RichMedia", "/3D", "/XFA", "/ResetForm", "/SetOCGState", "/Hide",
    "/Trans", "/GoTo3DView", "/Thread", "/Named",
}


class PolicyRejected(ValueError):
    pass


class RejectPdfWarnings(logging.Handler):
    def emit(self, record):
        if record.levelno >= logging.WARNING:
            raise PolicyRejected("pdf_parser_warning")


def check_action(action):
    action = action.get_object() if isinstance(action, IndirectObject) else action
    if not isinstance(action, DictionaryObject):
        raise PolicyRejected("pdf_action")
    kind = str(action.get("/S", ""))
    if kind == "/GoTo" and "/D" in action:
        return
    uri = action.get("/URI", "")
    if kind == "/URI" and isinstance(uri, str) and len(uri) <= 2048 and not any(ord(char) < 32 for char in uri):
        parsed = urlsplit(uri)
        if parsed.scheme.lower() in {"https", "http"} and parsed.hostname and not parsed.username and not parsed.password:
            return
    raise PolicyRejected("pdf_action")


def inspect_metadata(data):
    if len(data) > 1024 * 1024:
        raise PolicyRejected("pdf_metadata_limit")
    parser = expat.ParserCreate()
    def reject(*args):
        raise PolicyRejected("pdf_xml_entities")
    parser.StartDoctypeDeclHandler = reject
    parser.EntityDeclHandler = reject
    parser.ExternalEntityRefHandler = reject
    parser.Parse(data, True)


def inspect_pdf(data: bytes) -> dict:
    if not data.startswith(b"%PDF-") or not data.rstrip().endswith(b"%%EOF"):
        raise PolicyRejected("invalid_pdf_boundary")
    logger = logging.getLogger("pypdf")
    handler = RejectPdfWarnings()
    logger.addHandler(handler)
    old_limit = filters.ZLIB_MAX_OUTPUT_LENGTH
    filters.ZLIB_MAX_OUTPUT_LENGTH = MAX_DECODED_BYTES
    try:
        reader = PdfReader(io.BytesIO(data), strict=True)
        if reader.is_encrypted:
            raise PolicyRejected("encrypted_pdf")
        seen_refs, seen_direct = set(), set()
        decoded, visited = 0, 0

        def walk(value, depth=0):
            nonlocal decoded, visited
            if depth > 80:
                raise PolicyRejected("pdf_depth_limit")
            if isinstance(value, IndirectObject):
                key = (value.generation, value.idnum)
                if key in seen_refs:
                    return
                seen_refs.add(key)
                value = value.get_object()
            if isinstance(value, (DictionaryObject, ArrayObject)):
                key = id(value)
                if key in seen_direct:
                    return
                seen_direct.add(key)
                visited += 1
                if visited > MAX_PDF_OBJECTS:
                    raise PolicyRejected("pdf_object_limit")
            if isinstance(value, DictionaryObject):
                if any(str(key) in BLOCKED_KEYS for key in value):
                    raise PolicyRejected("pdf_active_content")
                if "/OpenAction" in value:
                    destination = value["/OpenAction"]
                    if not isinstance(destination, ArrayObject):
                        raise PolicyRejected("pdf_automatic_action")
                if "/A" in value:
                    check_action(value["/A"])
                if str(value.get("/Type", "")) == "/Action" or str(value.get("/S", "")) == "/URI":
                    check_action(value)
                # External stream data can be referenced without an action.
                if isinstance(value, StreamObject) and any(key in value for key in ("/F", "/FFilter", "/FDecodeParms")):
                    raise PolicyRejected("pdf_external_stream")
                for child in value.values():
                    walk(child, depth + 1)
                if isinstance(value, StreamObject):
                    stream_data = value.get_data()
                    decoded += len(stream_data)
                    if decoded > MAX_DECODED_BYTES:
                        raise PolicyRejected("pdf_decoded_size_limit")
                    if str(value.get("/Type", "")) == "/Metadata":
                        inspect_metadata(stream_data)
            elif isinstance(value, ArrayObject):
                for child in value:
                    walk(child, depth + 1)
            elif isinstance(value, NameObject) and str(value) in BLOCKED_NAMES:
                raise PolicyRejected("pdf_active_content")

        walk(reader.trailer)
        # Inspect every live xref entry, including objects in compressed streams
        # and currently unreferenced objects. pypdf decodes escaped PDF names.
        references = [(generation, number) for generation, entries in reader.xref.items()
                      for number in entries if number and generation != 65535]
        references += [(0, number) for number in reader.xref_objStm]
        if len(references) > MAX_PDF_OBJECTS:
            raise PolicyRejected("pdf_object_limit")
        for generation, number in references:
            walk(IndirectObject(number, generation, reader))
        pages = len(reader.pages)
        if not 1 <= pages <= 200:
            raise PolicyRejected("pdf_page_limit")
        return {"format": "PDF", "pages": pages, "objects": visited}
    finally:
        filters.ZLIB_MAX_OUTPUT_LENGTH = old_limit
        logger.removeHandler(handler)


def inspect_image(data: bytes, content_type: str) -> dict:
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    ImageFile.LOAD_TRUNCATED_IMAGES = False
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        with Image.open(io.BytesIO(data), formats=[TYPES[content_type]]) as image:
            if image.format != TYPES[content_type] or getattr(image, "n_frames", 1) != 1:
                raise PolicyRejected("unsupported_image")
            width, height = image.size
            if width <= 0 or height <= 0 or width * height > MAX_PIXELS:
                raise PolicyRejected("image_dimension_limit")
            image.verify()
        # verify() checks container integrity; load() also exercises decoding.
        with Image.open(io.BytesIO(data), formats=[TYPES[content_type]]) as image:
            image.load()
        return {"format": TYPES[content_type], "width": width, "height": height}


def inspect_document(data: bytes, kind: str, content_type: str) -> dict:
    maximum = EVIDENCE_MAX_BYTES if kind == "evidence" else IMAGE_MAX_BYTES
    if kind not in {"evidence", "message"} or not data or len(data) > maximum:
        raise PolicyRejected("file_size_or_kind")
    try:
        if content_type == "application/pdf" and kind == "evidence":
            details = inspect_pdf(data)
        elif content_type in TYPES:
            details = inspect_image(data, content_type)
        else:
            raise PolicyRejected("unsupported_type")
    except PolicyRejected:
        raise
    except Exception as error:
        raise PolicyRejected("invalid_document") from error
    return {"policyVersion": POLICY_VERSION, "policyPassed": True, **details}
