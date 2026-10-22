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

### 1. Create the certificate signing request (CSR)

1. Open Keychain Access:
   ```bash
   open -a "Keychain Access"
   ```
2. In the menu bar, choose **Keychain Access › Certificate Assistant › Request a Certificate from a Certificate Authority**.
3. **User Email Address:** your email. **Common Name:** `3DCoster Developer ID`. Leave **CA Email Address** empty.
4. Select **Saved to disk**, click **Continue**, and save `CertificateSigningRequest.certSigningRequest` to the Desktop.

### 2. Create the Developer ID Application certificate

Only the Account Holder can do this.

1. Go to <https://developer.apple.com/account/resources/certificates/list> (Certificates, Identifiers & Profiles › **Certificates**).
2. Click the **+** button at the top left.
3. Under **Software**, select **Developer ID**, then click **Continue**.
4. Choose **Developer ID Application**. If you're offered a choice of intermediate certificate, pick the default **G2 Sub-CA**.
5. Click **Choose File**, select the `.certSigningRequest` from your Desktop, click **Continue**, then click **Download**.
6. Double-click the downloaded `.cer` in Downloads. It installs into the **login** keychain.

### 3. Export the certificate as a `.p12`

1. In Keychain Access, select the **login** keychain, then open the **My Certificates** tab.
2. Find **Developer ID Application: <your organization> (<TEAM ID>)**. It should have a disclosure arrow with a private key under it; if there's no key, the certificate was created on another Mac.
3. Right-click the certificate row and choose **Export "Developer ID Application: …"**.
4. Name it `3dcoster-developer-id`, save it to the **Desktop**, and set **File Format** to **Personal Information Exchange (.p12)**. Click **Save**.
5. Enter a strong password and verify it. This becomes `APPLE_CERTIFICATE_PASSWORD`, so keep it in your password manager. If macOS then asks for your login keychain password, enter it to allow the export.

### 4. Upload the certificate secrets

The certificate is uploaded directly from the file, without going through the clipboard:

```bash
openssl base64 -A -in ~/Desktop/3dcoster-developer-id.p12 | gh secret set APPLE_CERTIFICATE -R Waarangel/3dcoster
```

For `APPLE_CERTIFICATE_PASSWORD`, open <https://github.com/Waarangel/3dcoster/settings/secrets/actions>. Click **New repository secret**, set the name to `APPLE_CERTIFICATE_PASSWORD`, enter the `.p12` password as the secret, and click **Add secret**.

### 5a. Notarization credential: App Store Connect API key (preferred)

1. Go to [App Store Connect](https://appstoreconnect.apple.com) › **Users and Access** › **Integrations**. The page opens on **App Store Connect API**.
2. If you see **Request Access**, click it, agree to the terms, and click **Submit**. Apple reviews these requests case by case. **While you wait, use 5b.** You can switch to the API key later.
3. Click **Team Keys**, then **Generate API Key** (or **+** if a key already exists).
4. Name it `3DCoster notarization` and set **Access** to **Developer**. Click **Generate**.
5. Click **Download** next to the new key. **The key can only be downloaded once.** It saves `AuthKey_<KEYID>.p8` to Downloads.
6. Upload the key file (this assumes it's the only `AuthKey_*.p8` in Downloads):
   ```bash
   gh secret set APPLE_API_PRIVATE_KEY -R Waarangel/3dcoster < ~/Downloads/AuthKey_*.p8
   ```
7. On the same page, copy the **Issuer ID** (shown above the keys table) and the key's **Key ID** (shown in its row). Add them as repository secrets, the same way as the password: `APPLE_API_ISSUER` = Issuer ID, `APPLE_API_KEY` = Key ID.
8. Move the `.p8` into your password manager or another safe place, then delete it from Downloads.

If notarization later fails with an HTTP 401/403 authorization error, the key's role is too narrow. Revoke the key and generate a new one with the **App Manager** role. A key's access can't be edited after it's created.

### 5b. Notarization credential: Apple ID (fallback)

1. At <https://account.apple.com>, go to **Sign-In and Security** › **App-Specific Passwords** › **Generate an app-specific password**. Name it `3DCoster notarization`.
2. Find your **Team ID** at <https://developer.apple.com/account> under **Membership details**.
3. Add three repository secrets: `APPLE_ID` (the account email), `APPLE_PASSWORD` (the app-specific password), and `APPLE_TEAM_ID`.

Once the API key is in place it takes over automatically. You can then delete these three secrets.

### 6. Clean up

Delete `~/Desktop/3dcoster-developer-id.p12` and the `.certSigningRequest` once both secrets are saved. The certificate and private key stay in your login keychain; back up the `.p12` in your password manager if you want a copy off this Mac.

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

Developer ID Application certificates last 5 years. Before the certificate expires, repeat steps 1–4 and replace `APPLE_CERTIFICATE` and `APPLE_CERTIFICATE_PASSWORD`. Apps that were already notarized keep working after the certificate expires.
