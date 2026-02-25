'use strict';

import path from 'path';
import fs from 'fs';
import selectors, { PLACEHOLDER } from './selectors.js';
import prompt from './prompt.js';
import { humanClick, humanPaste, randomDelay, delays } from './humanize.js';

/** Effective selector for chat input: use custom or fallback so we never wait on PLACEHOLDER. */
function chatInputSelector() {
  if (selectors.chatInput !== PLACEHOLDER) return selectors.chatInput;
  return 'textarea[data-testid="chat-input-ssr"], textarea[aria-label*="prompt"], textarea, [role="textbox"]';
}

const CLAUDE_URL = process.env.CLAUDE_URL || 'https://claude.ai';
const CLAUDE_PROJECT_URL = process.env.CLAUDE_PROJECT_URL || '';
const RESULTS_DIR = process.env.RESULTS_DIR || './data/results';
const RESPONSE_WAIT_TIMEOUT_MS = parseInt(process.env.RESPONSE_WAIT_TIMEOUT, 10) || 300000;
const STREAMING_POLL_MS = parseInt(process.env.STREAMING_POLL_INTERVAL, 10) || 2000;

function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

/**
 * Core workflow: navigate, enable thinking, upload file, send prompt, wait, download.
 * @param {import('playwright').Page} page
 * @param {string} docxFilePath Absolute or relative path to .docx file
 * @returns {Promise<{ success: boolean, filePath?: string, fileSize?: number, error?: string }>}
 */
export async function processFile(page, docxFilePath) {
  const resolvedPath = path.resolve(docxFilePath);
  if (!fs.existsSync(resolvedPath)) {
    return { success: false, error: `File not found: ${resolvedPath}` };
  }

  const baseUrl = CLAUDE_PROJECT_URL || CLAUDE_URL;

  try {
    // Step 1: Navigate to new chat
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await delays.afterNav();

    if (selectors.newChatButton !== PLACEHOLDER) {
      await humanClick(page, selectors.newChatButton);
      await delays.betweenActions();
    }

    await page.waitForSelector(chatInputSelector(), { state: 'visible', timeout: 15000 }).catch(() => null);

    // Step 2: Try Opus 4.6 (fallback to current model if unavailable, e.g. unpaid account)
    if (selectors.modelSelector !== PLACEHOLDER) {
      await delays.betweenActions();
      try {
        await humanClick(page, selectors.modelSelector);
        await randomDelay(500, 1200);
        const opusOption =
          selectors.modelOptionOpus46 !== PLACEHOLDER
            ? page.locator(selectors.modelOptionOpus46).first()
            : page.getByText('Opus 4.6').first();
        const visible = await opusOption.isVisible().catch(() => false);
        const disabled = await opusOption.getAttribute('aria-disabled').then((a) => a === 'true').catch(() => false);
        if (visible && !disabled) {
          if (selectors.modelOptionOpus46 !== PLACEHOLDER) {
            await humanClick(page, selectors.modelOptionOpus46);
          } else {
            await randomDelay(200, 500);
            await opusOption.click();
          }
        } else if (visible && disabled) {
          console.log('Opus 4.6 not available (e.g. upgrade required). Using current model.');
        }
        await randomDelay(300, 700);
        await page.keyboard.press('Escape');
      } catch (e) {
        console.log('Model selection skipped:', e.message);
      }
    }

    // Step 3: Try extended thinking (fallback: skip if disabled or not available)
    if (
      selectors.toolsMenuButton !== PLACEHOLDER &&
      selectors.thinkingToggle !== PLACEHOLDER
    ) {
      await delays.betweenActions();
      try {
        await humanClick(page, selectors.toolsMenuButton);
        await randomDelay(500, 1000);
        const toggle = page.locator(selectors.thinkingToggle).first();
        const visible = await toggle.isVisible().catch(() => false);
        const disabled = await toggle.getAttribute('aria-disabled').then((a) => a === 'true').catch(() => false);
        if (visible && !disabled) {
          const checked = await toggle.getAttribute('aria-checked').then((a) => a === 'true').catch(() => false);
          if (!checked) {
            await humanClick(page, selectors.thinkingToggle);
          }
        } else {
          console.log('Extended thinking not available. Continuing without it.');
        }
        await randomDelay(300, 800);
        await page.keyboard.press('Escape');
      } catch (e) {
        console.log('Extended thinking skipped:', e.message);
      }
    }

    // Step 4: Upload file
    await delays.betweenActions();
    const fileInput = await page.locator(selectors.fileInput).first();
    await fileInput.setInputFiles(resolvedPath);
    await delays.afterUpload();

    // Step 5: Type / paste prompt
    await delays.betweenActions();
    const inputSel = chatInputSelector();
    await humanPaste(page, inputSel, prompt);
    await delays.beforeSend();

    // Step 6: Send message (click send button or press Enter)
    if (selectors.sendButton !== PLACEHOLDER) {
      await humanClick(page, selectors.sendButton);
    } else {
      await page.keyboard.press('Enter');
    }
    await randomDelay(500, 1000);

    // Step 7: Wait for response to complete
    const responseStart = Date.now();
    if (selectors.streamingIndicator !== PLACEHOLDER) {
      await page.waitForSelector(selectors.streamingIndicator, { timeout: 120000 }).catch(() => null);
    }
    while (Date.now() - responseStart < RESPONSE_WAIT_TIMEOUT_MS) {
      const elapsed = Math.round((Date.now() - responseStart) / 1000);
      if (elapsed > 0 && elapsed % 15 === 0) {
        console.log(`Waiting for Claude response... ${elapsed}s`);
      }
      if (selectors.streamingIndicator !== PLACEHOLDER) {
        const stillStreaming = await page.locator(selectors.streamingIndicator).first().isVisible().catch(() => false);
        if (!stillStreaming) {
          await randomDelay(5000, 6000);
          break;
        }
      } else {
        await randomDelay(STREAMING_POLL_MS, STREAMING_POLL_MS + 500);
        if (Date.now() - responseStart > 60000) break;
      }
    }

    // Step 8: Download artifact
    await delays.afterResponse();
    ensureResultsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outFileName = `${timestamp}_result.docx`;
    const outPath = path.join(RESULTS_DIR, outFileName);

    if (selectors.artifactDownload === PLACEHOLDER) {
      return {
        success: false,
        error: 'artifactDownload selector not set. From the artifact page (sample-source-code/claude-artifact-chat.html), find the download button/link and set selectors.artifactDownload in src/selectors.js.',
      };
    }

    // Wait for artifact to render (button can appear a few seconds after response ends)
    const downloadBtn = page.locator(selectors.artifactDownload).first();
    await downloadBtn.waitFor({ state: 'visible', timeout: 60000 });
    await downloadBtn.scrollIntoViewIfNeeded().catch(() => null);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      humanClick(page, selectors.artifactDownload),
    ]);
    await download.saveAs(outPath);
    const stat = fs.statSync(outPath);
    console.log(`Downloaded: ${outFileName} (${stat.size} bytes)`);

    return { success: true, filePath: outPath, fileSize: stat.size };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
