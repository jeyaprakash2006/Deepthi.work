"""Package a locally compiled editor, preserving Deepthi's hosting policy."""
from pathlib import Path
import hashlib, re, subprocess, sys
app = sys.argv[1]
if app not in ('wordcraft', 'gridcraft', 'deckcraft'):
    raise SystemExit('Unknown editor')
root = Path(__file__).resolve().parent.parent
out = root / 'tmp' / ('generated-' + app)
out.mkdir(parents=True, exist_ok=True)
cli = root / 'tmp/wasm-bindgen-0.2.129-aarch64-apple-darwin/wasm-bindgen'
subprocess.run([str(cli), str(root / 'tmp/craft-target/wasm32-unknown-unknown/release' / (app + '-web.wasm')), '--target', 'web', '--out-dir', str(out), '--out-name', app + '-web'], check=True)
js = out / (app + '-web.js')
wasm = out / (app + '-web_bg.wasm')
digest = hashlib.sha256(js.read_bytes() + wasm.read_bytes()).hexdigest()[:16]
stem = app + '-deepthi-' + digest
dest = root / 'public/vendor' / app
html = (dest / 'index.html').read_text()
html = re.sub(r'<link[^>]+rel="(?:modulepreload|preload)"[^>]*>', '', html)
html = re.sub(r"'\./" + app + r"-[^']+\.js'", "'./" + stem + ".js'", html)
html = re.sub(r"'\./" + app + r"-[^']+\.wasm'", "'./" + stem + "_bg.wasm'", html)
for old in list(dest.glob('*.js')) + list(dest.glob('*.wasm')):
    old.unlink()
(dest / (stem + '.js')).write_text(js.read_text().replace(app + '-web_bg.wasm', stem + '_bg.wasm'))
(dest / (stem + '_bg.wasm')).write_bytes(wasm.read_bytes())
(dest / 'index.html').write_text(html)
print(app, stem, wasm.stat().st_size)
