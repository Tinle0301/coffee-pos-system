// tablet.test.js — the counter-tablet stylesheet is linked and keeps the
// touch-size rules. (Real sizes were checked in a browser at 1024x768 and
// 768x1024; this guards against the file being unlinked or the rules dropped.)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => readFileSync(join(here, f), 'utf8');

describe('tablet.css', () => {
  it('is linked from index.html after style.css', () => {
    const html = read('index.html');
    expect(html).toContain('./tablet.css');
    expect(html.indexOf('./tablet.css')).toBeGreaterThan(html.indexOf('./style.css'));
  });

  it('gives the Add button and header buttons at least 44px height', () => {
    const css = read('tablet.css');
    const heights = [...css.matchAll(/min-height:\s*(\d+)px/g)].map((m) => Number(m[1]));
    expect(heights.length).toBeGreaterThan(5);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  });

  it('removes the double-tap delay and has no hover-only rules', () => {
    const css = read('tablet.css');
    expect(css).toContain('touch-action: manipulation');
    expect(css).not.toMatch(/:hover/);
  });
});
