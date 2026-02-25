# Login detection without custom selectors – proposal

## Problem

1. **Custom selectors are not set yet.** `loggedInMarker` and `loginPageMarker` are `'TO_BE_DISCOVERED'`, so the script has no way to know when the user has logged in.

2. **Current logic fails when selectors are placeholders:**
   - `checkLogin(page)`:
     - If `loggedInMarker` is set → check it; else skip.
     - If `loginPageMarker` is set → check it; else skip.
     - **Fallback:** if URL contains `/login` → return false; **otherwise always return false.** So whenever selectors are unset, we **always** say "not logged in", even when the user is on the main app after magic link.
   - `waitForManualLogin(page)`:
     - Only checks `page.locator(selectors.loggedInMarker)` — i.e. `page.locator('TO_BE_DISCOVERED')`. That selector matches no real element, so we **never** detect login and always hit the 5-minute timeout.

3. **Result:** User pastes magic link, lands on claude.ai (logged in), but the script never recognises it and times out.

---

## Root cause

- Login detection is **entirely** tied to custom selectors.
- There is **no fallback** when those selectors are not yet filled in.
- We need detection that works **before** the user has discovered any selectors (and optionally still use custom selectors when they are set).

---

## Proposed solution: selector-free heuristics

Use **URL + page content** to infer login state, without requiring any custom selectors. Custom selectors, when set, can **override** or **refine** these heuristics.

### 1. “Logged out” (on login page)

Consider the user **not** logged in if **any** of the following hold:

- **URL:** Current page URL (after any redirects) contains `/login` (e.g. `https://claude.ai/login`, or `.../redirect/.../login`).
- **Content (when selectors not set):** Visible text on the page includes phrases like:
  - "Continue with Google"
  - "Sign in"
  - "Log in"
  - "Email" (in the sense of the login field label)

Use Playwright’s text locators, e.g. `page.getByText(/continue with google/i)` or `page.locator('text=Sign in')`, with short timeouts so we don’t block on missing text.

### 2. “Logged in”

Consider the user **logged in** if **all** of the following hold:

- **URL:** Current URL does **not** contain `/login` (so we’re not on the login screen).
- **Content (generic, no custom selectors):** At least one of:
  - A **chat-style input**: `textarea` or element with `role="textbox"` or `[contenteditable="true"]` that is visible and likely the main message input (e.g. in the main content area). This is a strong signal that the app has loaded the chat UI.
  - Or visible text that typically appears only in the app (e.g. “New chat”, or a placeholder like “Message Claude” / “Ask Claude”) to avoid false positives from a generic page.

Prefer the **presence of a textarea or role=textbox** as the primary “logged in” signal, since the login page does not show a chat input.

### 3. Algorithm (selector-free path)

**checkLogin(page):**

1. Navigate to `CLAUDE_URL` if not already there (or rely on user having pasted magic link in the same tab).
2. Wait for page to settle (e.g. 2–3 seconds).
3. **If** custom `loggedInMarker` is set → use it: if visible, return true.
4. **If** custom `loginPageMarker` is set → use it: if visible, return false.
5. **Otherwise (selector-free):**
   - If URL contains `/login` → return false.
   - Check for “login page” text (e.g. “Continue with Google”, “Sign in”). If visible → return false.
   - Check for “logged in” signal: URL does not contain `/login` and (visible chat input **or** “New chat” / “Message” text). If yes → return true.
   - Default → return false.

**waitForManualLogin(page):**

1. Log: “Please log in manually… (paste magic link or sign in). Waiting up to 5 minutes.”
2. Poll every 2–3 seconds:
   - **If** custom `loggedInMarker` is set → check it; if visible, break and return.
   - **Else (selector-free):** Run the same “logged in” heuristic (URL + chat input or text). If true, break and return.
3. Timeout after 5 minutes.
4. After detecting login, wait an extra 2–3 seconds for the SPA to settle before continuing the workflow.

### 4. Edge cases

- **Magic link in same tab:** User pastes link; page navigates to claude.ai (or claude.ai/). URL no longer has `/login`, and the app renders the chat UI (textarea / textbox). Selector-free logic should see “no /login” + “chat input present” → logged in.
- **New tab:** If the user opens the magic link in a new tab, our script only has one page (the first tab). We would need to detect new pages or switch to the tab where the user logged in. For the minimal POC, we assume the user pastes the link **in the same tab** we opened (or we navigate to CLAUDE_URL and they paste there). So we only check the current page.
- **Slow SPA:** After redirect, the chat input might appear after a short delay. Use a small wait (e.g. 2–3 s) after URL change, and when checking for “logged in”, use Playwright’s `waitForSelector` with a short timeout (e.g. 5–10 s) for the textarea/role=textbox so we don’t give up too early.

### 5. Implementation notes

- Use `page.url()` for URL checks (after any navigation).
- For “login page” text: `page.getByText(/continue with google|sign in|log in/i).first().isVisible().catch(() => false)` and similar, with a short timeout (e.g. 2 s) so we don’t wait forever if the text isn’t there.
- For “chat input”: e.g. `page.locator('textarea, [role="textbox"], [contenteditable="true"]').first().isVisible().catch(() => false)` with a short timeout. Optionally restrict to the main content area if the login page has any textbox (e.g. email field) by preferring elements that are likely the main message box (e.g. by size or position). If the login page has only “Email” and “Continue with Google”, a single visible `textarea` is likely the chat input.
- Keep existing custom-selector path so that once the user fills in `loggedInMarker` / `loginPageMarker`, we can use them for more precise or future-proof detection.

---

## Summary

- **Cause:** Login detection relied only on custom selectors; when they are `TO_BE_DISCOVERED`, we never report “logged in” and `waitForManualLogin` never succeeds.
- **Fix:** Add a **selector-free** path using URL (no `/login`) plus page content (login-page text vs chat input / app text). Use it when custom selectors are not set; otherwise keep using custom selectors. This allows the script to detect login after the user pastes the magic link in the same tab, without requiring any selector discovery first.
