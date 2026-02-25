'use strict';

/**
 * Human behavior simulation: random delays, mouse movement, variable typing speed.
 * All delays are random within ranges to avoid fixed patterns.
 */

/**
 * Sleep for a random duration between minMs and maxMs (inclusive).
 * @param {number} minMs
 * @param {number} maxMs
 * @returns {Promise<void>}
 */
export function randomDelay(minMs, maxMs) {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs + 1));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Linear interpolation.
 * @param {number} t 0..1
 * @param {number} a start
 * @param {number} b end
 */
function lerp(t, a, b) {
  return a + t * (b - a);
}

/**
 * Simple Bezier-like curve: ease in-out. t in [0,1].
 * @param {number} t
 */
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Move mouse from current position to (targetX, targetY) in steps with small random pauses.
 * Then click at the final position.
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {object} [options]
 * @param {number} [options.steps=4] Number of movement steps
 */
export async function humanClick(page, selector, options = {}) {
  const steps = options.steps ?? 4;
  const element = await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
  const box = await element.boundingBox();
  if (!box) throw new Error(`No bounding box for selector: ${selector}`);

  // Pick random point within the element (not dead center)
  const padding = Math.min(box.width, box.height) * 0.2;
  const x = box.x + padding + Math.random() * (box.width - 2 * padding);
  const y = box.y + padding + Math.random() * (box.height - 2 * padding);

  const current = await page.evaluate(() => ({ x: window.__lastMouseX ?? 0, y: window.__lastMouseY ?? 0 }));
  const startX = current.x || box.x + box.width / 2;
  const startY = current.y || box.y + box.height / 2;

  for (let i = 1; i <= steps; i++) {
    const t = easeInOut(i / steps);
    const stepX = lerp(t, startX, x);
    const stepY = lerp(t, startY, y);
    await page.mouse.move(stepX, stepY);
    await page.evaluate((px, py) => {
      window.__lastMouseX = px;
      window.__lastMouseY = py;
    }, stepX, stepY);
    await randomDelay(20, 80);
  }

  await randomDelay(50, 150);
  await page.mouse.click(x, y);
}

/**
 * Human-like typing: variable delay between characters, occasional longer pause.
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {string} text
 * @param {object} [options]
 * @param {number} [options.charDelayMin=50]
 * @param {number} [options.charDelayMax=200]
 * @param {number} [options.thinkPauseMin=300]
 * @param {number} [options.thinkPauseMax=800]
 * @param {number} [options.thinkEveryChars=15]
 */
export async function humanType(page, selector, text, options = {}) {
  const charDelayMin = options.charDelayMin ?? 50;
  const charDelayMax = options.charDelayMax ?? 200;
  const thinkPauseMin = options.thinkPauseMin ?? 300;
  const thinkPauseMax = options.thinkPauseMax ?? 800;
  const thinkEveryChars = options.thinkEveryChars ?? 15;

  await humanClick(page, selector);
  await randomDelay(500, 1000);

  for (let i = 0; i < text.length; i++) {
    await page.keyboard.type(text[i], { delay: 0 });
    await randomDelay(charDelayMin, charDelayMax);
    if (i > 0 && i % thinkEveryChars === 0) {
      await randomDelay(thinkPauseMin, thinkPauseMax);
    }
  }
}

/**
 * Paste text via clipboard (for long prompts). Uses insertText to avoid OS clipboard.
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {string} text
 */
export async function humanPaste(page, selector, text) {
  await humanClick(page, selector);
  await randomDelay(500, 1500);
  await page.keyboard.insertText(text);
  await randomDelay(500, 1500);
}

/**
 * Random scroll by amount pixels (positive = down, negative = up).
 * @param {import('playwright').Page} page
 * @param {number} [amount] If omitted, random 100-400 down or -100 to -400 up
 */
export async function humanScroll(page, amount) {
  const dir = typeof amount === 'number' ? Math.sign(amount) : (Math.random() > 0.5 ? 1 : -1);
  const delta = typeof amount === 'number' ? Math.abs(amount) : 100 + Math.floor(Math.random() * 300);
  await page.mouse.wheel(0, dir * delta);
  await randomDelay(500, 1500);
}

/**
 * Delays for common scenarios (convenience).
 */
export const delays = {
  afterNav: () => randomDelay(1500, 4000),
  betweenActions: () => randomDelay(500, 2000),
  beforeClick: () => randomDelay(300, 1000),
  afterUpload: () => randomDelay(2000, 3000),
  beforeSend: () => randomDelay(500, 1000),
  afterResponse: () => randomDelay(2000, 3000),
};
