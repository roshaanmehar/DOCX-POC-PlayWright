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
export default {
  // Chat input (textarea or [contenteditable="true"])
  chatInput: 'TO_BE_DISCOVERED',
  sendButton: 'TO_BE_DISCOVERED',

  // File upload: attach button (optional if we use hidden file input)
  attachButton: 'TO_BE_DISCOVERED',
  fileInput: 'input[type="file"]',

  // Extended thinking
  toolsMenuButton: 'TO_BE_DISCOVERED',
  thinkingToggle: 'TO_BE_DISCOVERED',

  // Response
  responseMessage: 'TO_BE_DISCOVERED',
  streamingIndicator: 'TO_BE_DISCOVERED',

  // Artifact download (button or link for .docx)
  artifactDownload: 'TO_BE_DISCOVERED',

  // Login state
  loggedInMarker: 'TO_BE_DISCOVERED',
  loginPageMarker: 'TO_BE_DISCOVERED',

  // New chat
  newChatButton: 'TO_BE_DISCOVERED',
};
