"""Build byte-reproducible ZIP evidence from the committed synthetic sources.

The format deliberately uses ZIP_STORED, sorted entry names, fixed timestamps,
fixed Unix file modes, no directory records, and no host paths. This avoids
zlib-version drift and lets a second reviewer reproduce the same bytes.
"""

from __future__ import annotations

import hashlib
import json
import stat
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCES = ROOT / "sources"
ARCHIVES = ROOT / "archives"
FIXED_TIME = (1980, 1, 1, 0, 0, 0)

PACKAGES = (
    {
        "source": "itemized-health-synthetic-core-v1",
        "archive": "itemized-health-synthetic-core-v1-2026-08-24.zip",
        "expected_files": 12,
    },
    {
        "source": "billing-advocacy-kit",
        "archive": "claude-tabletop-kit-corrected-2026-08-24.zip",
        "expected_files": 35,
    },
)


def source_files(source: Path) -> list[Path]:
    files: list[Path] = []
    for path in source.rglob("*"):
        if path.is_symlink():
            raise RuntimeError(f"Symlink is not allowed: {path}")
        if path.is_file():
            files.append(path)
    return sorted(files, key=lambda path: path.relative_to(source).as_posix())


def tree_sha256(source: Path, files: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in files:
        relative = path.relative_to(source).as_posix()
        data = path.read_bytes()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(len(data).to_bytes(8, "big"))
        digest.update(data)
    return digest.hexdigest()


def write_archive(source: Path, destination: Path, files: list[Path]) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(
        destination,
        mode="w",
        compression=zipfile.ZIP_STORED,
        allowZip64=True,
    ) as archive:
        archive.comment = b""
        for path in files:
            relative = path.relative_to(source).as_posix()
            archive_name = f"{source.name}/{relative}"
            info = zipfile.ZipInfo(archive_name, date_time=FIXED_TIME)
            info.compress_type = zipfile.ZIP_STORED
            info.create_system = 3
            info.create_version = 20
            info.extract_version = 20
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            info.internal_attr = 0
            info.extra = b""
            info.comment = b""
            archive.writestr(info, path.read_bytes())


def main() -> int:
    expected_path = ROOT / "EXPECTED_SHA256.json"
    expected = json.loads(expected_path.read_text(encoding="utf-8"))
    result: dict[str, object] = {
        "format": "sorted-zip-stored-v1",
        "fixed_timestamp": "1980-01-01T00:00:00",
        "packages": [],
    }
    for package in PACKAGES:
        source = SOURCES / str(package["source"])
        destination = ARCHIVES / str(package["archive"])
        files = source_files(source)
        expected_files = int(package["expected_files"])
        if len(files) != expected_files:
            raise RuntimeError(
                f"{source.name}: expected {expected_files} files, found {len(files)}"
            )
        write_archive(source, destination, files)
        data = destination.read_bytes()
        row = {
            "source": source.name,
            "archive": destination.name,
            "files": len(files),
            "source_tree_sha256": tree_sha256(source, files),
            "archive_bytes": len(data),
            "archive_sha256": hashlib.sha256(data).hexdigest(),
        }
        pinned = expected["packages"][destination.name]
        row["expected_match"] = (
            row["files"] == pinned["files"]
            and row["archive_bytes"] == pinned["bytes"]
            and row["source_tree_sha256"] == pinned["sourceTreeSha256"]
            and row["archive_sha256"] == pinned["archiveSha256"]
        )
        if not row["expected_match"]:
            raise RuntimeError(f"Reproducible evidence mismatch: {destination.name}")
        result["packages"].append(row)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
