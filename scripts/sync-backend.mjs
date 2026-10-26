#!/usr/bin/env node
// sync-backend.mjs — POS-34
//
// Vercel deploys only frontend/src/, so the live site cannot import files
// from backend/. The site uses a copy of the backend files in
// frontend/src/backend/. This script makes that copy, so nobody has to
// copy files by hand and the two folders cannot drift apart.
//
// Usage (from the repo root):
//   node scripts/sync-backend.mjs          copy backend/ -> frontend/src/backend/
//   node scripts/sync-backend.mjs --check  only compare; exit 1 if out of date (used by CI)
//
// To ship another backend file to the site, add it to FILES below and run
// the script again.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'backend');
const DEST = join(ROOT, 'frontend', 'src', 'backend');

// [file in backend/, file in frontend/src/backend/, optional text fixes]
const FILES = [
  ['config.js', 'config.js'],
  ['supabase-client.js', 'supabase-client.js'],
  // auth.js sits one folder higher in the copy, so its import path changes
  ['services/auth.js', 'auth.js', [["from '../supabase-client.js'", "from './supabase-client.js'"]]],
  ['services/staff.js', 'services/staff.js'],
  ['services/menu.js', 'services/menu.js'],
  ['services/orders.js', 'services/orders.js'],
  ['services/orderItems.js', 'services/orderItems.js'],
  ['services/payments.js', 'services/payments.js'],
  ['services/queue.js', 'services/queue.js'],
  ['services/orderStatus.js', 'services/orderStatus.js'],
  ['services/transactions.js', 'services/transactions.js'],
];

const check = process.argv.includes('--check');
const outOfDate = [];
let updated = 0;

for (const [from, to, fixes = []] of FILES) {
  const srcPath = join(SRC, from);
  const destPath = join(DEST, to);

  let text = readFileSync(srcPath, 'utf8');
  for (const [find, replace] of fixes) {
    if (!text.includes(find)) {
      console.error(`sync-backend: expected "${find}" in backend/${from}, update FILES in this script`);
      process.exit(2);
    }
    text = text.replace(find, replace);
  }

  const current = existsSync(destPath) ? readFileSync(destPath, 'utf8') : null;
  if (current === text) continue;

  if (check) {
    outOfDate.push(`frontend/src/backend/${to}`);
  } else {
    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, text);
    updated++;
    console.log(`updated frontend/src/backend/${to}`);
  }
}

if (check) {
  if (outOfDate.length) {
    console.error('These copies are out of date with backend/:');
    for (const f of outOfDate) console.error(`  ${f}`);
    console.error('Run: node scripts/sync-backend.mjs  and commit the result.');
    process.exit(1);
  }
  console.log('frontend/src/backend/ matches backend/');
} else if (updated === 0) {
  console.log('frontend/src/backend/ is up to date');
}
