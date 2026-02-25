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

## Named profiles (select and save by name)

- Use **`--profile <name>`** or **`-p <name>`** to select a profile. The first time you use a name, a new profile is created and saved under `data/browser-profiles/<name>/`; the next run with the same name reuses it.
- **Examples:**
  - `node src/index.js --profile work ./template.docx` — use profile "work"
  - `node src/index.js -p personal ./template.docx` — use profile "personal"
- **List profiles:** `node src/index.js --list-profiles` — lists profile names and exits.
- **Reset a profile:** `node src/index.js [--profile <name>] --reset` — deletes that profile’s data so the next run requires login again.

## Session persistence

- Default profile is `default` (path `data/browser-profiles/default/`). With `BROWSER_PROFILE_DIR` set and no `BROWSER_PROFILE`, the legacy single folder is used.
- Next run reuses the same profile → no re-login unless Claude invalidates the session.
- To copy a session: copy the profile folder (e.g. `data/browser-profiles/work`) and use `--profile work` on the other machine (only one process per profile at a time).

## Model and extended thinking

- The script **tries** to select **Opus 4.6** and enable **extended thinking** before sending (when the corresponding selectors are set in `src/selectors.js`).
- If your account doesn’t have access (e.g. not paid), the script **falls back**: it keeps the current model and skips extended thinking, then continues. You’ll see a short message in the console; the run does not fail.

## Verification

- Run with a real .docx template.
- Confirm: file uploads, prompt is sent, Claude responds, .docx is downloaded to `data/results/`.
- Open the downloaded .docx and check placeholders.
- Run again without closing the browser → no re-login.
- Kill the process, restart → session should still be valid from the profile directory.

---

## How to test (after implementation)

### 1. Fix “Too many arguments” (humanize)

- Run: `node src/index.js ./path/to/any.docx` (or use a real .docx path).
- Before fix: you get *"Too many arguments. If you need to pass more than 1 argument..."*.
- After fix: no such error; the script proceeds (and may then wait for login or fail later on selectors).

### 2. Named profiles

- **List (empty):**  
  `node src/index.js --list-profiles`  
  Expected: `No profiles yet. Use --profile <name> to create one.` or `Profiles: default` if `data/browser-profiles/default` already exists.
- **Create/use a profile:**  
  `node src/index.js --profile mytest ./path/to/template.docx`  
  Expected: Browser uses `data/browser-profiles/mytest/` (folder is created). Log in if prompted; run completes or fails on later steps (e.g. artifact selector).
- **List again:**  
  `node src/index.js --list-profiles`  
  Expected: `Profiles: mytest` (and `default` if it exists).
- **Use same profile again:**  
  `node src/index.js --profile mytest ./path/to/template.docx`  
  Expected: No new login; same profile is reused.

### 3. Reset profile

- **Reset default:**  
  `node src/index.js --reset`  
  Expected: Message like `Profile 'default' reset. Next run will require login.` and exit (no browser).
- **Reset named profile:**  
  `node src/index.js --profile mytest --reset`  
  Expected: `Profile 'mytest' reset. Next run will require login.` and exit. Next run with `--profile mytest` should show login again.

### 4. Opus 4.6 + extended thinking and fallback

- With selectors still `TO_BE_DISCOVERED`: script does not try model/thinking; no error.
- After you set `modelSelector` and `modelOptionOpus46` (and tools/thinking) in `src/selectors.js`:
  - **Paid account:** Script should select Opus 4.6 and enable extended thinking, then continue.
  - **Unpaid/free account:** Script should log e.g. *"Opus 4.6 not available (e.g. upgrade required). Using current model."* and/or *"Extended thinking not available. Continuing without it."*, then continue without failing.
- Run with `BROWSER_HEADLESS=false` and watch the model/tools menu to confirm try-and-fallback behaviour.
