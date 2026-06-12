// Canonical app version — one of the four artifacts bumped on every release
// (with CHANGELOG.md, src-tauri/tauri.conf.json, src-tauri/Cargo.toml).
// Lives in its own module so utilities (backupExport meta, etc.) can read it
// without importing component code.
export const APP_VERSION = '1.5.0';
