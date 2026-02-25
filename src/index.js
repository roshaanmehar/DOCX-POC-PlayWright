'use strict';

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { launch, checkLogin, waitForManualLogin, shutdown, getProfilePath, getProfilesBase } from './browser.js';
import { processFile } from './worker.js';

// Parse profile from CLI before launch (env is read by browser.js)
const profileIndex = process.argv.findIndex((a) => a === '--profile' || a === '-p');
if (profileIndex !== -1 && process.argv[profileIndex + 1]) {
  process.env.BROWSER_PROFILE = process.argv[profileIndex + 1];
}

// Positional short form: (profile, document) when two non-flag args and first isn't .docx
function getPositionalArgs() {
  const skip = new Set();
  if (profileIndex !== -1 && process.argv[profileIndex + 1]) {
    skip.add(profileIndex);
    skip.add(profileIndex + 1);
  }
  const positionals = process.argv
    .map((a, i) => (skip.has(i) ? null : a))
    .filter((a) => a && !a.startsWith('--') && a !== '-p' && a !== 'node' && !a.endsWith('index.js'));
  return positionals;
}

const positionals = getPositionalArgs();
if (positionals.length >= 2 && !positionals[0].toLowerCase().endsWith('.docx') && positionals[1].toLowerCase().endsWith('.docx')) {
  process.env.BROWSER_PROFILE = positionals[0];
}

const ONCE_FLAG = process.argv.includes('--once');
const WATCH_FLAG = process.argv.includes('--watch');
const LIST_PROFILES_FLAG = process.argv.includes('--list-profiles');
const RESET_FLAG = process.argv.includes('--reset') || process.argv.includes('--reset-profile');

function getDocxArg() {
  if (positionals.length >= 2 && positionals[1].toLowerCase().endsWith('.docx')) {
    return positionals[1];
  }
  const args = process.argv.filter((a) => !a.startsWith('--') && a !== '-p' && a.endsWith('.docx'));
  return args[0];
}

function validateFile(filePath) {
  if (!filePath) {
    console.error('Usage: node src/index.js [--once] [--profile <name>] <path-to-template.docx>');
    console.error('       node src/index.js --list-profiles');
    console.error('       node src/index.js [--profile <name>] --reset');
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
  if (LIST_PROFILES_FLAG) {
    const base = getProfilesBase();
    if (!fs.existsSync(base)) {
      console.log('No profiles yet. Use --profile <name> to create one.');
      process.exit(0);
    }
    const names = fs.readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    if (names.length === 0) {
      console.log('No profiles yet. Use --profile <name> to create one.');
    } else {
      console.log('Profiles:', names.join(', '));
    }
    process.exit(0);
  }

  if (RESET_FLAG) {
    const profilePath = getProfilePath();
    const profileName = process.env.BROWSER_PROFILE || 'default';
    if (fs.existsSync(profilePath)) {
      fs.rmSync(profilePath, { recursive: true, force: true });
      console.log(`Profile '${profileName}' reset. Next run will require login.`);
    } else {
      console.log(`Profile '${profileName}' not found at ${profilePath}. Nothing to reset.`);
    }
    process.exit(0);
  }

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
