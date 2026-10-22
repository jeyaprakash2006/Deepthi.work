# Building Deepthi's editor distribution

The three full Git clones live at `upstream/{wordcraft,gridcraft,deckcraft}` locally (ignored to avoid nested repositories). Complete pinned source snapshots are committed in `sources/`, with SHA256 digests and original commits in `sources/manifest.json`. Deepthi's changes are committed as reproducible patches in `patches/`. Copyright, contributor, and license notices are preserved.

Run `python3 scripts/restore-editor-sources.py` to reconstruct missing checkouts without touching existing ones. Alternatively, extract its source archive into an empty directory and apply the matching patch with `git apply`. Alternatively clone the manifest repository, checkout the manifest commit, then apply the patch. Do not apply a patch twice to an already modified local clone.

Build prerequisites: Rust stable (tested 1.99.1), `wasm32-unknown-unknown` target, and wasm-bindgen CLI 0.2.129. The packaging helper currently expects the official macOS arm64 CLI under `tmp/wasm-bindgen-0.2.129-aarch64-apple-darwin/`.

From the workspace root, replacing APP with wordcraft, gridcraft, or deckcraft:

```sh
CARGO_TARGET_DIR="$PWD/tmp/craft-target" CARGO_PROFILE_RELEASE_LTO=false cargo build --manifest-path upstream/APP/Cargo.toml --release --target wasm32-unknown-unknown -p APP-web --locked -j 4
python3 scripts/package-editor.py APP
npm run build
npm test
```

Packaging generates unique asset filenames, preserves the Deepthi title, local-only navigation script and CSP, and removes stale integrity metadata. Optional craft-fonts inputs are not required; these builds use the bundled fallback fonts. The private/unavailable `storytold/craftrules` referenced by upstream instructions could not be retrieved.

Changes remove community buttons from Docs title bar, backstage and Help ribbon; remove their settings toggle and keyboard hint; remove promotional website/Discord/GitHub links from About/start screens; remove Slides' promotional Learn More action; and render contributor names as plain text. The host policy remains defense in depth for document hyperlinks.

Quill includes an original editable A4 Question Paper template in File > New (also on Home). The template is implemented by the engine `file.new` command with id `question-paper`; no upload or import is needed.
