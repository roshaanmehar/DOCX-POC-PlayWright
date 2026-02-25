'use strict';

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { launch, checkLogin, waitForManualLogin, shutdown } from './browser.js';
import { processFile } from './worker.js';

const ONCE_FLAG = process.argv.includes('--once');
const WATCH_FLAG = process.argv.includes('--watch');

function getDocxArg() {
  const args = process.argv.filter((a) => !a.startsWith('--') && a.endsWith('.docx'));
  return args[0];
}

function validateFile(filePath) {
  if (!filePath) {
    console.error('Usage: node src/index.js [--once] <path-to-template.docx>');
    console.error('   Or: node src/index.js --watch <directory>');
    process.exit(1);
  }
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error('File not found:', resolved);
    process.exit(1);
  }
  if (!resolved.toLowerCase().endsWith('.docx')) {
    console.error('File must be a .docx:', resolved);
    process.exit(1);
  }
  return resolved;
}

async function runOne(context, page, docxPath) {
  const result = await processFile(page, docxPath);
  if (result.success) {
    console.log('Success:', result.filePath, `(${result.fileSize} bytes)`);
  } else {
    console.error('Failed:', result.error);
  }
  return result;
}

async function main() {
  if (WATCH_FLAG) {
    const dir = process.argv[process.argv.indexOf('--watch') + 1];
    if (!dir || !fs.existsSync(path.resolve(dir))) {
      console.error('Usage: node src/index.js --watch <directory>');
      process.exit(1);
    }
    console.log('Watch mode not implemented in this POC. Run one-shot: node src/index.js ./path/to/file.docx');
    process.exit(0);
  }

  const docxPath = validateFile(getDocxArg());

  const { context, page } = await launch();

  try {
    const loggedIn = await checkLogin(page);
    if (!loggedIn) {
      await waitForManualLogin(page);
    }

    const result = await runOne(context, page, docxPath);

    if (ONCE_FLAG) {
      await shutdown(context);
      process.exit(result.success ? 0 : 1);
    }

    console.log('Browser left open. Run again with another file or use --once to exit after one file.');
  } catch (err) {
    console.error(err);
    await shutdown(context).catch(() => {});
    process.exit(1);
  }
}

main();
