# macOS signing and notarization

The Mac `.dmg` builds are signed with a **Developer ID Application** certificate and notarized + stapled by Apple, so they open without Gatekeeper's "3DCoster is damaged" warning.

## How it works

- `release.yml` runs `scripts/configure-macos-signing.sh` on the two macOS rows only. The script reads the repo secrets below and exports only the ones that are set. The Tauri bundler (CLI 2.9.6) then does everything itself:
  - imports the `.p12` into a temporary keychain;
  - signs the `.app` with the hardened runtime (Tauri's default);
  - submits it to Apple's notary service and staples the ticket;
  - signs the `.dmg`.
- **Soft gate.** If the secrets are missing or incomplete, the build shows a `macOS build is UNSIGNED` warning and ships unsigned, the same as before. If a signed build fails (for example Apple rejects notarization, or the password is wrong), the job shows a `macOS signing failed — shipping UNSIGNED` warning and rebuilds that architecture with `--no-sign`. Signing never blocks a release.
- No entitlements file is needed. The app uses no JIT, camera, microphone or other hardened-runtime exceptions; the WebView's JIT runs in Apple's own signed WebKit process.
- `macos-sign-check.yml` builds a signed Apple Silicon `.dmg` without releasing, and fails unless Gatekeeper's own check (`spctl`) reports `source=Notarized Developer ID`.

## Secrets (repo `Waarangel/3dcoster` → Settings → Secrets and variables → Actions)

| Secret | Value |
|---|---|
| `APPLE_CERTIFICATE` | base64 of the exported `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | password you chose when exporting the `.p12` |
| **Notarization, option A (preferred): App Store Connect API key** | |
| `APPLE_API_KEY` | Key ID |
| `APPLE_API_ISSUER` | Issuer ID |
| `APPLE_API_PRIVATE_KEY` | contents of the downloaded `AuthKey_<KEYID>.p8` |
| **Notarization, option B: Apple ID** (use only if API access isn't approved yet) | |
| `APPLE_ID` | Apple Account email of the developer account |
| `APPLE_PASSWORD` | an app-specific password (not your Apple Account password) |
| `APPLE_TEAM_ID` | 10-character Team ID |

You need the two certificate secrets plus **one** complete notarization set. If both sets are present, the API key is used: the script exports only that set.

## One-time setup (Account Holder)

The commands below run as-is with the Run button; none of them need editing. They read and write files on your Desktop or in Downloads, so no secret is ever typed or pasted into a terminal.

Done on 2026-10-22 with the commands below, so the founder never had to use Keychain Access. Keychain Access's Certificate Assistant failed with "The specified item could not be found in the keychain" while a key was selected. All files live in `~/Documents/3DCoster-signing` (chmod 700). Back that folder up to a password manager: it holds the private key, the `.p12` and its password.

### 1. Create the private key and the certificate signing request (CSR)

```bash
mkdir -p ~/Documents/3DCoster-signing && chmod 700 ~/Documents/3DCoster-signing && cd ~/Documents/3DCoster-signing && /usr/bin/openssl req -new -newkey rsa:2048 -nodes -keyout developer-id.key -out CertificateSigningRequest.certSigningRequest -subj "/CN=3DCoster Developer ID" && open ~/Documents/3DCoster-signing
```

### 2. Create the Developer ID Application certificate (Account Holder only)

1. Go to <https://developer.apple.com/account/resources/certificates/list> and click the **+** next to **Certificates**.
2. Under **Software**, select **Developer ID Application** and click **Continue**. Keep the default **G2 Sub-CA**.
3. Click **Choose File**, select `~/Documents/3DCoster-signing/CertificateSigningRequest.certSigningRequest`, click **Continue**, then **Download**. This saves `~/Downloads/developerID_application.cer`. Don't double-click it.

### 3. Build the `.p12` and upload `APPLE_CERTIFICATE` + `APPLE_CERTIFICATE_PASSWORD`

Use `/usr/bin/openssl` (LibreSSL): its `.p12` encryption is the kind macOS `security import` accepts. Homebrew's OpenSSL 3 would need `-legacy`.

```bash
cd ~/Documents/3DCoster-signing && /usr/bin/openssl rand -base64 24 > p12-password.txt && /usr/bin/openssl x509 -inform DER -in ~/Downloads/developerID_application.cer -out developer-id.pem && /usr/bin/openssl pkcs12 -export -inkey developer-id.key -in developer-id.pem -name "Developer ID Application: How to Project Inc." -passout file:p12-password.txt -out 3dcoster-developer-id.p12 && /usr/bin/openssl base64 -A -in 3dcoster-developer-id.p12 | gh secret set APPLE_CERTIFICATE -R Waarangel/3dcoster && tr -d '\n' < p12-password.txt | gh secret set APPLE_CERTIFICATE_PASSWORD -R Waarangel/3dcoster && gh secret list -R Waarangel/3dcoster
```

### 4. (unused) Keychain Access route

Instead of steps 1–3, you can create the CSR in Keychain Access (**Keychain Access › Certificate Assistant › Request a Certificate From a Certificate Authority**). Click an empty area first, so the menu item doesn't say *With "<key>"*. Then export the installed certificate from **My Certificates** as a `.p12`.

### 5a. Notarization credential: App Store Connect API key (preferred)

1. Go to [App Store Connect](https://appstoreconnect.apple.com) › **Users and Access** › **Integrations**. The page opens on **App Store Connect API**.
2. If you see **Request Access**, click it, agree to the terms, and click **Submit**. Apple reviews these requests case by case. **While you wait, use 5b.** You can switch to the API key later.
3. Click **Team Keys**, then **Generate API Key** (or **+** if a key already exists).
4. Name it `3DCoster notarization` and set **Access** to **Developer**. Click **Generate**.
5. Click **Download** next to the new key. **The key can only be downloaded once.** It saves `AuthKey_<KEYID>.p8` to Downloads.
6. Upload the key and the Key ID (the Key ID is in the file name):
   ```bash
   mv ~/Downloads/AuthKey_<KEYID>.p8 ~/Documents/3DCoster-signing/ && gh secret set APPLE_API_PRIVATE_KEY -R Waarangel/3dcoster < ~/Documents/3DCoster-signing/AuthKey_<KEYID>.p8 && printf '<KEYID>' | gh secret set APPLE_API_KEY -R Waarangel/3dcoster
   ```
7. Click **Copy** next to **Issuer ID**, then run this. It checks the clipboard holds a UUID before uploading:
   ```bash
   ISSUER="$(pbpaste | tr -d '[:space:]')"; if [[ "$ISSUER" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then printf '%s' "$ISSUER" | gh secret set APPLE_API_ISSUER -R Waarangel/3dcoster && gh secret list -R Waarangel/3dcoster; else echo "The clipboard doesn't contain an Issuer ID."; fi
   ```
8. Back up the `.p8` (in `~/Documents/3DCoster-signing`) to a password manager. Apple won't let you download it again.

If notarization later fails with an HTTP 401/403 authorization error, the key's role is too narrow. Revoke the key and generate a new one with the **App Manager** role. A key's access can't be edited after it's created.

### 5b. Notarization credential: Apple ID (fallback)

1. At <https://account.apple.com>, go to **Sign-In and Security** › **App-Specific Passwords** › **Generate an app-specific password**. Name it `3DCoster notarization`.
2. Find your **Team ID** at <https://developer.apple.com/account> under **Membership details**.
3. Add three repository secrets: `APPLE_ID` (the account email), `APPLE_PASSWORD` (the app-specific password), and `APPLE_TEAM_ID`.

Once the API key is in place it takes over automatically. You can then delete these three secrets.

### 6. Back up

Save the contents of `~/Documents/3DCoster-signing` to a password manager. Keep the private key (`developer-id.key`), the `.p12`, `p12-password.txt` and the `.p8`. Without them, a lost Mac means making a new certificate and key.

## Proving it before a release

1. Push the `feat/macos-signing` branch. `macos-sign-check.yml` runs automatically on it. Once the file is on `main`, you can also run it from **Actions › macOS Signing Check › Run workflow**.
2. A green run means the app's signature verifies, the notarization ticket is stapled, and `spctl` reports `source=Notarized Developer ID`.
3. Download the `3dcoster-macos-signed-dmg` artifact, open the `.dmg`, drag the app to Applications, and launch it. It should open with at most the standard "downloaded from the internet" prompt, never "damaged". Note that the artifact download is a zip, and unzipping it can drop the quarantine flag. The real-world test is the next release download through a browser.

## What the next tagged release proves

- Both macOS rows log `macOS signing enabled (notarization via …)`, with no `UNSIGNED` or `signing failed` warnings.
- The `_aarch64.dmg` and `_x64.dmg` on the GitHub release open on a clean Mac without the Gatekeeper workaround.
- Windows and Linux are unchanged: the signing steps are skipped on those rows.

If a run shows the `UNSIGNED` or `signing failed` warning, the "signed and notarized" wording on the FAQ, the Download page and in the release notes isn't true for that release. Fix the secrets and re-release, or correct the copy. Merge the copy changes to `main` with (or after) the first signed release; Vercel deploys them right away.

## Renewal

The current certificate (**Developer ID Application: How to Project Inc. (XM85G2CQ29)**, G2) is valid until **2027-11-21**. Before then, repeat steps 1–3; that creates a new CSR, certificate and `.p12`, and replaces both certificate secrets. To check the date:

```bash
/usr/bin/openssl x509 -in ~/Documents/3DCoster-signing/developer-id.pem -noout -subject -enddate
```

Apps that were already notarized keep opening after the certificate expires. Only new builds need a valid certificate. The API key doesn't expire until it's revoked.
