"""Restore source snapshots into empty local clone directories, then apply Deepthi patches."""
from pathlib import Path
import hashlib, json, subprocess, tarfile
root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'upstream/sources/manifest.json').read_text())
for app, info in manifest.items():
    destination = root / 'upstream' / app
    if destination.exists():
        print(f'{app}: existing checkout preserved')
        continue
    archive = root / 'upstream/sources' / info['archive']
    if hashlib.sha256(archive.read_bytes()).hexdigest() != info['sha256']:
        raise SystemExit(f'{app}: archive checksum mismatch')
    destination.mkdir()
    with tarfile.open(archive) as source:
        for member in source.getmembers():
            target = (destination / member.name).resolve()
            if destination.resolve() not in target.parents or not (member.isfile() or member.isdir()):
                raise SystemExit(f'{app}: unsafe archive entry {member.name}')
        source.extractall(destination)
    subprocess.run(['git', 'apply', str(root / 'upstream/patches' / (app + '.patch'))], cwd=destination, check=True)
    print(f'{app}: complete source and Deepthi patch restored')
