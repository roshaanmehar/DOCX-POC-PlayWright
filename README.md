# CV Formatter – Claude.ai Chat Automation POC

Minimal POC: automate Claude.ai to **upload a .docx template**, **send an analysis prompt**, **wait for the response**, and **download the resulting .docx artifact** — all via a **persistent browser session**.

No job queue, ntfy, IMAP, or Express. Just a Node.js script + Playwright (with stealth) + human-like behavior.

## Quick start

```bash
npm install
npx playwright install chromium
```

Copy `.env.example` to `.env` and set `BROWSER_HEADLESS=false` for first run.

```bash
node src/index.js ./path/to/your-template.docx
```

Browser opens → **log in to claude.ai manually** (Google, or paste the magic link in the same tab). Login is detected automatically via URL + page content (no selectors needed); once the chat UI appears, the script continues: uploads file, sends prompt, waits, downloads the result to `data/results/`.

## Login detection (no selectors required)

The script detects login **without** custom selectors by checking: URL no longer contains `/login`, and the chat UI is present (e.g. a visible `textarea` or “New chat” / “Message Claude” text). So you can paste the magic link in the same tab and the script will detect success and continue. Optional: once you fill in `loggedInMarker` / `loginPageMarker` in `src/selectors.js`, those are used for more precise detection.

## First-run: discover selectors (for upload / send / download)

1. Run with `BROWSER_HEADLESS=false`.
2. Log in manually when the browser opens.
3. When the chat is visible, open DevTools (F12). Right-click each element → Inspect → Copy selector (or note a stable `data-testid` / `aria-label`).
4. Edit **`src/selectors.js`** and replace each `TO_BE_DISCOVERED` with the real selector for:
   - **chatInput** – textarea or contenteditable for the message
   - **sendButton** – send message button
   - **fileInput** – usually `input[type="file"]` (may be hidden)
   - **toolsMenuButton** / **thinkingToggle** – extended thinking (optional)
   - **streamingIndicator** – e.g. “Claude is thinking” or spinner
   - **artifactDownload** – download button/link when Claude returns a file
   - **loggedInMarker** – any element that only exists when logged in (e.g. sidebar)
   - **loginPageMarker** – e.g. “Continue with Google” or “Sign in”
   - **newChatButton** – new chat button
5. Kill and rerun; automation should complete end-to-end.
6. Optionally set `BROWSER_HEADLESS=true` for headless runs.

## Modes

- **One-shot (default):** Process one file, then keep the browser open for another run.
- **Exit after one:** `node src/index.js --once ./file.docx` — process one file and close the browser.

## Session persistence

- Profile is stored in `./data/browser-profile/` (or `BROWSER_PROFILE_DIR`).
- Next run reuses the same profile → no re-login unless Claude invalidates the session.
- To “copy session” to another machine: copy the `browser-profile` folder and set `BROWSER_PROFILE_DIR` to it (only one process can use a profile at a time).

## Verification

- Run with a real .docx template.
- Confirm: file uploads, prompt is sent, Claude responds, .docx is downloaded to `data/results/`.
- Open the downloaded .docx and check placeholders.
- Run again without closing the browser → no re-login.
- Kill the process, restart → session should still be valid from the profile directory.
