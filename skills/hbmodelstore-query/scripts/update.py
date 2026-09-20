#!/usr/bin/env python3
"""Update only this installed Skill from the official, hash-checked ZIP."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import stat
import sys
import tempfile
import urllib.request
from pathlib import Path, PurePosixPath
from zipfile import BadZipFile, ZipFile

NAME = "hbmodelstore-query"
RELEASE_LINE = "public-v1"
DOWNLOAD_ROOT = "https://api.delirium.com.cn/docs/downloads/"
MANIFEST_URL = DOWNLOAD_ROOT + NAME + ".json"
ZIP_URL = DOWNLOAD_ROOT + NAME + ".zip"
MAX_ZIP_BYTES = 20 * 1024 * 1024
MAX_UNPACKED_BYTES = 50 * 1024 * 1024
SEMVER = re.compile(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)")


def version_key(value: str) -> tuple[int, ...]:
    if not isinstance(value, str) or not SEMVER.fullmatch(value):
        raise ValueError("invalid public version")
    return tuple(map(int, value.split(".")))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("official update URL must not redirect")


def download(url: str, limit: int) -> bytes:
    if url not in {MANIFEST_URL, ZIP_URL}:
        raise ValueError("unsupported update URL")
    request = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
    with urllib.request.build_opener(NoRedirect).open(request, timeout=30) as response:
        result = response.read(limit + 1)
    if len(result) > limit:
        raise ValueError("download exceeds size limit")
    return result


def validate_manifest(manifest: dict) -> None:
    if not isinstance(manifest, dict):
        raise ValueError("invalid official update manifest")
    if manifest.get("name") != NAME or manifest.get("release_line") != RELEASE_LINE:
        raise ValueError("unexpected Skill or public release line")
    version_key(manifest.get("version"))
    if manifest.get("url") != ZIP_URL:
        raise ValueError("manifest does not point to the official ZIP")
    if not re.fullmatch(r"[0-9a-f]{64}", str(manifest.get("sha256", ""))):
        raise ValueError("missing or invalid ZIP SHA-256")
    size = manifest.get("size")
    if type(size) is not int or not 0 < size <= MAX_ZIP_BYTES:
        raise ValueError("invalid ZIP size")


def installed_metadata(target: Path) -> dict:
    if target.name != NAME or not (target / "SKILL.md").is_file():
        raise ValueError("target is not an installed hbmodelstore-query Skill")
    metadata = json.loads((target / "version.json").read_text(encoding="utf-8"))
    if not isinstance(metadata, dict):
        raise ValueError("invalid installation metadata")
    if metadata.get("name") != NAME or metadata.get("release_line") != RELEASE_LINE:
        raise ValueError("installation has no compatible public version metadata")
    version_key(metadata.get("version"))
    return metadata


def validate_target(target: Path) -> None:
    # Do not follow symlinks or replace the source copy in a development checkout.
    if target != target.resolve():
        raise ValueError("refusing to replace a symlinked installation")
    if any((parent / ".git").exists() for parent in (target, *target.parents)):
        raise ValueError("refusing to replace a Git checkout; update its source instead")
    if any(path.is_symlink() for path in target.rglob("*")):
        raise ValueError("refusing to replace a Skill containing symlinks")


def unpack(data: bytes, manifest: dict, staging: Path) -> Path:
    if len(data) != manifest["size"] or hashlib.sha256(data).hexdigest() != manifest["sha256"]:
        raise ValueError("ZIP size or SHA-256 mismatch; original installation unchanged")
    with ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        if not entries or len(entries) > 2000:
            raise ValueError("invalid ZIP file count")
        if sum(entry.file_size for entry in entries) > MAX_UNPACKED_BYTES:
            raise ValueError("unpacked ZIP exceeds size limit")
        seen = set()
        for entry in entries:
            path = PurePosixPath(entry.filename)
            parts = path.parts
            if (
                not parts
                or path.is_absolute()
                or parts[0] != NAME
                or ".." in parts
                or ".git" in parts
                or "\\" in entry.filename
                or ":" in entry.filename
                or entry.filename.rstrip("/") != path.as_posix()
                or path.as_posix().casefold() in seen
                or entry.flag_bits & 1
            ):
                raise ValueError("unsafe or duplicate ZIP path")
            seen.add(path.as_posix().casefold())
            kind = stat.S_IFMT(entry.external_attr >> 16)
            if kind not in {0, stat.S_IFREG, stat.S_IFDIR}:
                raise ValueError("ZIP links and special files are not allowed")
        for entry in entries:
            output = staging / entry.filename
            if entry.is_dir():
                output.mkdir(parents=True, exist_ok=True)
            else:
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_bytes(archive.read(entry))
                output.chmod(0o755 if entry.external_attr >> 16 & 0o111 else 0o644)
    candidate = staging / NAME
    metadata = installed_metadata(candidate)
    if metadata["version"] != manifest["version"]:
        raise ValueError("ZIP version differs from manifest")
    for relative in ("scripts/client.py", "scripts/update.py", "capabilities.json"):
        if not (candidate / relative).is_file():
            raise ValueError(f"incomplete Skill package: {relative}")
    capabilities = json.loads((candidate / "capabilities.json").read_text(encoding="utf-8"))
    if capabilities.get("skill") != NAME or not capabilities.get("capabilities"):
        raise ValueError("invalid capability manifest")
    return candidate


def package_matches(target: Path, candidate: Path) -> bool:
    """Compare shipped files, ignoring only runtime files excluded by the ZIP builder."""
    def files(root: Path) -> dict:
        return {
            path.relative_to(root): path
            for path in root.rglob("*")
            if (path.is_file() or path.is_symlink())
            and not any(
                part in {".DS_Store", "__pycache__"} for part in path.relative_to(root).parts
            )
            and path.suffix != ".pyc"
        }

    current, latest = files(target), files(candidate)
    return current.keys() == latest.keys() and all(
        not current[name].is_symlink() and current[name].read_bytes() == path.read_bytes()
        for name, path in latest.items()
    )


def update(target: Path, *, apply: bool) -> dict:
    current = installed_metadata(target)
    if apply:
        validate_target(target)
    manifest = json.loads(download(MANIFEST_URL, 65536))
    validate_manifest(manifest)
    remote_version = version_key(manifest["version"])
    local_version = version_key(current["version"])
    newer = remote_version > local_version
    data = None
    content_changed = None
    if remote_version == local_version:
        # Public version and package content are independent. No extra version catalog needed.
        data = download(ZIP_URL, MAX_ZIP_BYTES)
        with tempfile.TemporaryDirectory(prefix=f"{NAME}-check-") as temp:
            candidate = unpack(data, manifest, Path(temp))
            content_changed = not package_matches(target, candidate)
    available = newer or content_changed is True
    result = {
        "ok": True,
        "installed": current["version"],
        "latest": manifest["version"],
        "update_available": available,
        "same_version_content_changed": content_changed,
        "updated": False,
    }
    if not apply or not available:
        return result
    # Exclusive sibling lock prevents two agents from interleaving directory swaps.
    lock = target.parent / f".{NAME}.update.lock"
    descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        if data is None:
            data = download(ZIP_URL, MAX_ZIP_BYTES)
        with tempfile.TemporaryDirectory(prefix=f".{NAME}.update-", dir=target.parent) as temp:
            staging = Path(temp)
            candidate = unpack(data, manifest, staging)
            backup = target.parent / f".{NAME}.previous-{staging.name.rsplit('-', 1)[-1]}"
            if backup.exists():
                raise ValueError("backup path already exists")
            target.rename(backup)
            try:
                candidate.rename(target)
            except OSError:
                backup.rename(target)
                raise
            result.update(updated=True, backup=str(backup), restart_agent=True)
    finally:
        os.close(descriptor)
        lock.unlink()
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--check", action="store_true")
    modes.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    # abspath deliberately preserves symlinks so validate_target can reject them.
    target = Path(os.path.abspath(__file__)).parent.parent
    try:
        print(json.dumps(update(target, apply=args.apply), ensure_ascii=False))
        return 0
    except (OSError, ValueError, KeyError, TypeError, BadZipFile) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
