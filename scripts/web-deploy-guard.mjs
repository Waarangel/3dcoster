// Web-deploy guard — BLOCKING PreToolUse hook.
//
// Pushing to `main` auto-deploys the web app LIVE to https://3dcoster.com via
// Vercel (.claude/CLAUDE.md "Auto-deploys on push to main"). Going live must be
// a deliberate, user-approved act — so this blocks any `git push` that targets
// `main` (or an ambiguous bare `git push`, which pushes the current branch to
// its upstream) unless the command explicitly opts in with DEPLOY_OK=1.
//
// Added 2026-06-15 after several web deploys slipped past the guardrails — the
// existing release-cadence guard + warn hook only watch `v*` DESKTOP tags, so
// `git push origin main` (the web deploy path) had no gate. Pushing a feature
// branch (`git push origin feat/x`) is NOT affected.
//
// Protocol: exit 2 blocks the tool call and shows stderr; exit 0 allows.

let data = '';
process.stdin.on('data', (chunk) => {
  data += chunk;
});
process.stdin.on('end', () => {
  let command = '';
  try {
    command = JSON.parse(data).tool_input?.command ?? '';
  } catch {
    process.exit(0); // unparseable input → don't block
  }

  // Blank out quoted substrings so we never match `main`/`push` inside a commit
  // message, echo string, etc.
  const bare = command.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');

  if (!/\bgit\s+push\b/.test(bare)) process.exit(0); // not a push at all

  // Match `main` only as a standalone token, so branches like `main-v2` or
  // `my-main-feature` are NOT mistaken for the main branch.
  const targetsMain = /\bgit\s+push\b[^\n]*(?<![\w-])main(?![\w-])/.test(bare);
  // Bare `git push` (no explicit remote) pushes the current branch to its
  // upstream; if that's main it's a deploy, and we can't know the branch here.
  const isBarePush = !/\bgit\s+push\b[^\n]*\b(origin|upstream)\b/.test(bare);

  if (!targetsMain && !isBarePush) process.exit(0); // pushing a feature branch → fine

  // Check the opt-in on the quote-stripped string so a token hidden inside a
  // quoted arg (e.g. a commit message) can't bypass the gate.
  if (/\bDEPLOY_OK=1\b/.test(bare)) process.exit(0); // explicit, deliberate opt-in

  process.stderr.write(
    '⛔ BLOCKED: this `git push` targets `main`, which auto-deploys LIVE to ' +
      'https://3dcoster.com (Vercel).\n' +
      'Going live is a deliberate, user-approved act — confirm with the user first.\n' +
      'To deploy intentionally, re-run with the explicit opt-in:\n' +
      '    DEPLOY_OK=1 git push origin main\n'
  );
  process.exit(2);
});
