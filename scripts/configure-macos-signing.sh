#!/usr/bin/env bash
# Decides whether a macOS CI build is signed + notarized, and exports ONLY the
# Apple variables that are actually set into $GITHUB_ENV for the Tauri build.
#
# Why it exports selectively instead of passing secrets straight into the
# tauri-action step: the Tauri bundler treats a variable that is present but
# EMPTY as set (Rust `var_os` returns Some("")), so `APPLE_CERTIFICATE: ''`
# from a missing secret makes it try to import an empty certificate and fail
# the build. Unset secrets must stay unset.
#
# All-or-nothing (soft gate, same style as the CHANGELOG / Discord checks):
# signing is enabled only when the certificate AND a complete notarization
# credential set are present. A signed-but-not-notarized app still gets the
# Gatekeeper warning, so a partial setup warns and builds unsigned instead of
# shipping something that looks fixed but isn't. Missing secrets never fail
# the release.
#
# Inputs (env, from repo secrets):
#   APPLE_CERTIFICATE           base64 of the Developer ID Application .p12
#   APPLE_CERTIFICATE_PASSWORD  password the .p12 was exported with
#   Notarization, App Store Connect API key (preferred):
#     APPLE_API_KEY             Key ID
#     APPLE_API_ISSUER          Issuer ID
#     APPLE_API_PRIVATE_KEY     contents of AuthKey_<KEYID>.p8 (written to a file)
#   Notarization, Apple ID (fallback):
#     APPLE_ID, APPLE_PASSWORD (app-specific password), APPLE_TEAM_ID
#
# Outputs: `enabled=true|false` in $GITHUB_OUTPUT.
# Names of the variables the Tauri bundler reads are from
# https://v2.tauri.app/distribute/sign/macos/ and tauri-bundler's
# bundle/macos/sign.rs (Tauri CLI 2.9.6).
set -euo pipefail

: "${GITHUB_ENV:?must run inside GitHub Actions}"
: "${GITHUB_OUTPUT:?must run inside GitHub Actions}"
: "${RUNNER_TEMP:?must run inside GitHub Actions}"

disable() {
  echo "::warning title=macOS build is UNSIGNED::$1 Users will see the Gatekeeper \"damaged\" warning. See docs/MACOS-SIGNING.md."
  echo "enabled=false" >> "$GITHUB_OUTPUT"
  exit 0
}

# Writes NAME=value to $GITHUB_ENV with a heredoc delimiter, so values with
# special characters (passwords) are passed through intact.
export_env() {
  local name="$1" value="$2"
  {
    echo "${name}<<APPLE_SIGNING_EOF_3DCOSTER"
    printf '%s\n' "$value"
    echo "APPLE_SIGNING_EOF_3DCOSTER"
  } >> "$GITHUB_ENV"
}

if [ -z "${APPLE_CERTIFICATE:-}" ] && [ -z "${APPLE_CERTIFICATE_PASSWORD:-}" ]; then
  disable "Signing secrets are not configured (APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD)."
fi
if [ -z "${APPLE_CERTIFICATE:-}" ] || [ -z "${APPLE_CERTIFICATE_PASSWORD:-}" ]; then
  disable "Only one of APPLE_CERTIFICATE / APPLE_CERTIFICATE_PASSWORD is set; both are required."
fi

notary=""
if [ -n "${APPLE_API_KEY:-}" ] && [ -n "${APPLE_API_ISSUER:-}" ] && [ -n "${APPLE_API_PRIVATE_KEY:-}" ]; then
  notary="api-key"
elif [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_PASSWORD:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ]; then
  notary="apple-id"
else
  disable "Certificate is set but notarization credentials are incomplete (need APPLE_API_KEY + APPLE_API_ISSUER + APPLE_API_PRIVATE_KEY, or APPLE_ID + APPLE_PASSWORD + APPLE_TEAM_ID)."
fi

export_env APPLE_CERTIFICATE "$APPLE_CERTIFICATE"
export_env APPLE_CERTIFICATE_PASSWORD "$APPLE_CERTIFICATE_PASSWORD"

if [ "$notary" = "api-key" ]; then
  key_path="$RUNNER_TEMP/AuthKey_${APPLE_API_KEY}.p8"
  printf '%s\n' "$APPLE_API_PRIVATE_KEY" > "$key_path"
  chmod 600 "$key_path"
  export_env APPLE_API_KEY "$APPLE_API_KEY"
  export_env APPLE_API_ISSUER "$APPLE_API_ISSUER"
  export_env APPLE_API_KEY_PATH "$key_path"
else
  export_env APPLE_ID "$APPLE_ID"
  export_env APPLE_PASSWORD "$APPLE_PASSWORD"
  export_env APPLE_TEAM_ID "$APPLE_TEAM_ID"
fi

echo "macOS signing enabled (notarization via ${notary})."
echo "enabled=true" >> "$GITHUB_OUTPUT"
