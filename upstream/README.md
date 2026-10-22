# Craft editor sources

Full Git repositories cloned from Storytold. Each checkout matches the web release served by Deepthi.work. These repositories are ignored by the parent Git repository; commit any editor changes inside their own checkout.

| Editor | Tag | Commit | Origin |
| --- | --- | --- | --- |
| wordcraft | v0.9.0 | `2e6db0bd88795e80375176c01665cff7dbe2b057` | https://github.com/storytold/wordcraft.git |
| gridcraft | v0.10.0 | `2ebdf164c2c9c536122e0a2cffe79078b5c818ac` | https://github.com/storytold/gridcraft.git |
| deckcraft | v0.5.0 | `a98df49b21632d69a3da994d35df1ea91dab41af` | https://github.com/storytold/deckcraft.git |

The checked-out tags use detached HEAD. Create a `codex/` branch before editing an upstream project. Read its own AGENTS.md and README before making changes. Browser assets remain in `public/vendor/`; source edits only take effect after rebuilding and replacing those assets.

This UI refresh changes the React workspace and editor chrome. It does not change or rebuild the Rust editor interfaces. DeckCraft remains pinned to v0.5.0 because newer tested web releases panic on startup.

## Deepthi customization

The local clones now use branch `codex/deepthi-local-ui`. Complete source snapshots, patches and reconstruction instructions are in `sources/`, `patches/` and `BUILD.md`. These are tracked by the parent repository, so the source and our changes are included in GitHub pushes. The browser binaries are now rebuilt from these sources with community/promotional controls removed.
