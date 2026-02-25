'use strict';

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import selectors from './selectors.js';
import { randomDelay } from './humanize.js';

let _chromium = chromium;
try {
  const stealth = StealthPlugin();
  _chromium.use(stealth);
} catch (e) {
  console.warn('Stealth plugin not available, launching without it:', e.message);
}

const BROWSER_HEADLESS = process.env.BROWSER_HEADLESS !== 'false';
const BROWSER_PROFILE_DIR = process.env.BROWSER_PROFILE_DIR || './data/browser-profile';
const CLAUDE_URL = process.env.CLAUDE_URL || 'https://claude.ai';
const LOGIN_POLL_MS = 2500;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const PAGE_STABILIZE_MS = 3000;
const HEURISTIC_WAIT_MS = 2000;

/**
 * Selector-free: detect if we are still on the login page (URL or visible login text).
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean>} true if login page is visible
 */
async function isLoginPageHeuristic(page) {
  const url = page.url();
  if (url.includes('/login')) return true;

  const loginTexts = [
    /continue with google/i,
    /sign in/i,
    /log in/i,
    /sign in with google/i,
  ];
  for (const re of loginTexts) {
    const found = await page.getByText(re).first().isVisible().catch(() => false);
    if (found) return true;
  }
  return false;
}

/**
 * Selector-free: detect if the chat UI is present (logged-in state).
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean>}
 */
async function isLoggedInHeuristic(page) {
  const url = page.url();
  if (url.includes('/login')) return false;

  const hasChatInput = await page
    .locator('textarea, [role="textbox"], [contenteditable="true"]')
    .first()
    .isVisible()
    .catch(() => false);
  if (hasChatInput) return true;

  const appOnlyText = [/new chat/i, /message claude/i, /ask claude/i];
  for (const re of appOnlyText) {
    const found = await page.getByText(re).first().isVisible().catch(() => false);
    if (found) return true;
  }
  return false;
}

/**
 * Launch persistent Chromium context. Profile is saved to BROWSER_PROFILE_DIR.
 * @returns {Promise<{ context: import('playwright').BrowserContext, page: import('playwright').Page }>}
 */
export async function launch() {
  const context = await _chromium.launchPersistentContext(BROWSER_PROFILE_DIR, {
    headless: BROWSER_HEADLESS,
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
    args: ['--disable-blink-features=AutomationControlled'],
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  });

  let page = context.pages()[0];
  if (!page) {
    page = await context.newPage();
  }

  return { context, page };
}

/**
 * Check if we are logged in to Claude.ai.
 * Uses custom selectors when set; otherwise uses selector-free URL + content heuristics.
 * @param {import('playwright').Page} page
 * @returns {Promise<boolean>}
 */
export async function checkLogin(page) {
  await page.goto(CLAUDE_URL, { waitUntil: 'domcontentloaded' });
  await randomDelay(PAGE_STABILIZE_MS, PAGE_STABILIZE_MS + 500);

  if (selectors.loggedInMarker !== 'TO_BE_DISCOVERED') {
    const loggedIn = await page.locator(selectors.loggedInMarker).first().isVisible().catch(() => false);
    if (loggedIn) return true;
  }

  if (selectors.loginPageMarker !== 'TO_BE_DISCOVERED') {
    const onLoginPage = await page.locator(selectors.loginPageMarker).first().isVisible().catch(() => false);
    if (onLoginPage) return false;
  }

  // Selector-free: use URL + page content heuristics
  if (await isLoginPageHeuristic(page)) return false;
  if (await isLoggedInHeuristic(page)) return true;
  return false;
}

/**
 * Wait for user to log in manually. Polls until login is detected (custom selector or heuristic) or timeout.
 * Works when you paste the magic link in the same tab: URL and chat UI are used to detect success.
 * @param {import('playwright').Page} page
 */
export async function waitForManualLogin(page) {
  console.log('Please log in manually in the browser window (paste magic link or sign in). Waiting up to 5 minutes...');
  const start = Date.now();

  while (Date.now() - start < LOGIN_TIMEOUT_MS) {
    if (selectors.loggedInMarker !== 'TO_BE_DISCOVERED') {
      const visible = await page.locator(selectors.loggedInMarker).first().isVisible().catch(() => false);
      if (visible) {
        console.log('Login detected (custom selector).');
        await randomDelay(HEURISTIC_WAIT_MS, HEURISTIC_WAIT_MS + 500);
        return;
      }
    } else {
      const loggedIn = await isLoggedInHeuristic(page);
      if (loggedIn) {
        console.log('Login detected (URL + chat UI).');
        await randomDelay(HEURISTIC_WAIT_MS, HEURISTIC_WAIT_MS + 500);
        return;
      }
    }
    await randomDelay(LOGIN_POLL_MS, LOGIN_POLL_MS + 500);
  }

  throw new Error('Login timeout. Please run again and log in within 5 minutes (paste magic link in this tab).');
}

/**
 * Close context and save profile to disk.
 * @param {import('playwright').BrowserContext} context
 */
export async function shutdown(context) {
  await context.close();
}
