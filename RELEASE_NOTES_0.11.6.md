# Craft Agents v0.11.6

## Fixes
- **Packaged renderer** — load the Electron UI without relying on Node globals; provide browser-safe `Buffer`, `process`, and renderer-only stubs for Node dependencies (#62).
- **Mind-map identity** — preserve deterministic SHA-256 content hashes in the packaged renderer, including multi-block and UTF-8 inputs (#63).
- **macOS signing** — keep unsigned local builds explicit while allowing signing identity discovery when complete notarization credentials are configured (#63).
- **Rox Connect onboarding** — render the Connect flow locally in the Electron renderer.

## Build
- macOS arm64 DMG built from the tagged commit.
- Download the attached DMG and verify it against the published SHA-256 checksum before installation.
