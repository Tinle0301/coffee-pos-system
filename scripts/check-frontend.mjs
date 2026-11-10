#!/usr/bin/env node
// check-frontend.mjs — POS-59
//
// Fast checks on the files Vercel serves (frontend/src/), run in CI before
// the frontend tests. Each one catches a mistake that has blanked the live
// site before:
//
//   1. Leftover merge-conflict markers (<<<<<<< / ======= / >>>>>>>) in any
//      .js, .mjs, .css or .html file.
//   2. JavaScript that doesn't parse (node --check).
//   3. A relative import of a file that doesn't exist.
//   4. A named import that the other file doesn't export
//      (e.g. listTransactionLog vs listTransactionLogs).
//
// One broken import stops the browser from loading the whole app, so any
// problem here fails the PR.
//
// Usage (from the repo root):
//   node scripts/check-frontend.mjs

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'frontend', 'src');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage']);
const TEXT_EXTS = new Set(['.js', '.mjs', '.css', '.html']);
const JS_EXTS = new Set(['.js', '.mjs']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (TEXT_EXTS.has(extname(name))) out.push(full);
  }
  return out;
}

const problems = [];
const rel = (p) => relative(ROOT, p);
const files = walk(SRC);
const jsFiles = files.filter((f) => JS_EXTS.has(extname(f)));
const isTest = (f) => /\.test\.m?js$/.test(f);

// 1. merge-conflict markers --------------------------------------------------
const MARKER = /^(<{7}|={7}|>{7})(\s|$)/;
for (const file of files) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (MARKER.test(line)) {
      problems.push(`${rel(file)}:${i + 1}  merge-conflict marker "${line.trim().slice(0, 20)}"`);
    }
  });
}

// 2. syntax -------------------------------------------------------------------
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    const firstError = (result.stderr || '').split('\n').find((l) => /Error/.test(l)) || 'syntax error';
    problems.push(`${rel(file)}  does not parse: ${firstError.trim()}`);
  }
}

// 3 + 4. imports ------------------------------------------------------------
// Only static imports of relative paths are checked; CDN imports (https://)
// and package imports (vitest, jsdom) are skipped. Test files are skipped too:
// they mock modules that may not exist yet.
const IMPORT = /^\s*import\s+(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\})?\s*(?:\*\s+as\s+[\w$]+\s*)?from\s+['"](\.{1,2}\/[^'"]+)['"]/gm;

function exportedNames(source) {
  const names = new Set();
  for (const m of source.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([\w$]+)/g)) {
    names.add(m[1]);
  }
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop();
      if (name) names.add(name);
    }
  }
  if (/export\s+default\b/.test(source)) names.add('default');
  return names;
}

for (const file of jsFiles.filter((f) => !isTest(f))) {
  const source = readFileSync(file, 'utf8');
  for (const m of source.matchAll(IMPORT)) {
    const [, defaultName, named, spec] = m;
    const target = resolve(dirname(file), spec);
    if (!existsSync(target)) {
      problems.push(`${rel(file)}  imports "${spec}", which does not exist`);
      continue;
    }
    const exported = exportedNames(readFileSync(target, 'utf8'));
    if (defaultName && !exported.has('default')) {
      problems.push(`${rel(file)}  imports a default export from "${spec}", which has none`);
    }
    for (const part of (named || '').split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0];
      if (name && !exported.has(name)) {
        problems.push(`${rel(file)}  imports { ${name} } from "${spec}", which does not export it`);
      }
    }
  }
}

// report ------------------------------------------------------------------
if (problems.length) {
  console.error(`check-frontend: ${problems.length} problem(s) — the live site would break:`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`check-frontend: ${files.length} files OK (no conflict markers, ${jsFiles.length} JS files parse, imports resolve)`);
