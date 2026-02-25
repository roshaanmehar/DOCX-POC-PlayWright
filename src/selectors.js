'use strict';

/**
 * DOM selectors for claude.ai UI.
 *
 * HOW TO DISCOVER SELECTORS:
 * 1. Run the script with BROWSER_HEADLESS=false so the browser opens.
 * 2. Manually log in, then when the chat is visible, press F12 (DevTools).
 * 3. Use "Select an element" (Ctrl+Shift+C) and click the element you need.
 * 4. In the Elements panel, right-click the highlighted node → Copy → Copy selector
 *    (or Copy JS path). Prefer stable selectors: data-testid, aria-label, or unique
 *    class names. Avoid fragile nth-child or long generated class hashes.
 * 5. Replace the TO_BE_DISCOVERED values below with your selectors.
 *
 * Elements to find:
 * - Chat input (textarea or contenteditable)
 * - Send button
 * - Attach / file upload button (or the hidden input[type="file"])
 * - Extended thinking toggle (tools/settings menu)
 * - Response message container (to detect when streaming is done)
 * - Streaming indicator (e.g. "Claude is thinking" or a spinner)
 * - Artifact download button/link (when Claude returns a file)
 * - Logged-in marker (e.g. sidebar, user menu, or main chat area)
 * - Login page marker (e.g. "Continue with Google", "Sign in")
 * - New chat button
 */
// Placeholder value: when a selector is not set, worker uses fallbacks (see worker.js).
const PLACEHOLDER = 'TO_BE_DISCOVERED';

export default {
  // Chat input — from sample: textarea with data-testid="chat-input-ssr"
  chatInput: '[data-testid="chat-input-ssr"]',
  // Send: often a button with arrow icon; fallback in worker is keyboard Enter
  sendButton: 'TO_BE_DISCOVERED',

  // File upload: hidden input; attach button opens it (optional)
  attachButton: 'TO_BE_DISCOVERED',
  fileInput: 'input[type="file"]',

  // Model selection (bottom of chat card: click to open model list, then choose Opus 4.6)
  modelSelector: 'TO_BE_DISCOVERED',
  modelOptionOpus46: 'TO_BE_DISCOVERED',

  // Extended thinking (model/tools menu)
  toolsMenuButton: 'TO_BE_DISCOVERED',
  thinkingToggle: 'TO_BE_DISCOVERED',

  // Response
  responseMessage: 'TO_BE_DISCOVERED',
  streamingIndicator: 'TO_BE_DISCOVERED',

  // Artifact download (when Claude returns a file) — button with aria-label="Download"
  artifactDownload: 'button[aria-label="Download"]',

  // Login state — from sample: user menu only visible when logged in
  loggedInMarker: '[data-testid="user-menu-button"]',
  loginPageMarker: 'TO_BE_DISCOVERED',

  // New chat — from sample: sidebar link
  newChatButton: 'a[aria-label="New chat"]',
};

export { PLACEHOLDER };
