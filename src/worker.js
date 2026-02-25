'use strict';

import path from 'path';
import fs from 'fs';
import selectors from './selectors.js';
import prompt from './prompt.js';
import { humanClick, humanPaste, randomDelay, delays } from './humanize.js';

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

    if (selectors.newChatButton !== 'TO_BE_DISCOVERED') {
      await humanClick(page, selectors.newChatButton);
      await delays.betweenActions();
    }

    await page.waitForSelector(selectors.chatInput, { state: 'visible', timeout: 15000 }).catch(() => null);

    // Step 2: Enable extended thinking (optional; skip if selectors not set)
    if (
      selectors.toolsMenuButton !== 'TO_BE_DISCOVERED' &&
      selectors.thinkingToggle !== 'TO_BE_DISCOVERED'
    ) {
      await delays.betweenActions();
      await humanClick(page, selectors.toolsMenuButton);
      await randomDelay(500, 1000);
      const toggle = await page.locator(selectors.thinkingToggle).first();
      const checked = await toggle.getAttribute('aria-checked').then((a) => a === 'true').catch(() => false);
      if (!checked) {
        await humanClick(page, selectors.thinkingToggle);
      }
      await randomDelay(300, 800);
      await page.keyboard.press('Escape');
    }

    // Step 3: Upload file
    await delays.betweenActions();
    const fileInput = await page.locator(selectors.fileInput).first();
    await fileInput.setInputFiles(resolvedPath);
    await delays.afterUpload();

    // Step 4: Type / paste prompt
    await delays.betweenActions();
    await humanPaste(page, selectors.chatInput, prompt);
    await delays.beforeSend();

    // Step 5: Send message
    await humanClick(page, selectors.sendButton);
    await randomDelay(500, 1000);

    // Step 6: Wait for response to complete
    const responseStart = Date.now();
    if (selectors.streamingIndicator !== 'TO_BE_DISCOVERED') {
      await page.waitForSelector(selectors.streamingIndicator, { timeout: 120000 }).catch(() => null);
    }
    while (Date.now() - responseStart < RESPONSE_WAIT_TIMEOUT_MS) {
      const elapsed = Math.round((Date.now() - responseStart) / 1000);
      if (elapsed > 0 && elapsed % 15 === 0) {
        console.log(`Waiting for Claude response... ${elapsed}s`);
      }
      if (selectors.streamingIndicator !== 'TO_BE_DISCOVERED') {
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

    // Step 7: Download artifact
    await delays.afterResponse();
    ensureResultsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outFileName = `${timestamp}_result.docx`;
    const outPath = path.join(RESULTS_DIR, outFileName);

    if (selectors.artifactDownload === 'TO_BE_DISCOVERED') {
      return {
        success: false,
        error: 'artifactDownload selector not set. Inspect the page when Claude returns a file and set selectors.artifactDownload in src/selectors.js',
      };
    }

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
