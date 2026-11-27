// @ts-check
/**
 * @file Build script — copies shippable files into _site/ for deployment.
 */

import { rm, mkdir, cp } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SITE = resolve(ROOT, '_site');

const ITEMS = [
  'index.html',
  'favicon.svg',
  'manifest.webmanifest',
  'sw.js',
  'css',
  'js',
  'samples',
  '.nojekyll',
];

async function build() {
  await rm(SITE, { recursive: true, force: true });
  await mkdir(SITE, { recursive: true });

  for (const item of ITEMS) {
    const src = resolve(ROOT, item);
    const dest = resolve(SITE, item);
    await cp(src, dest, { recursive: true });
  }

  console.log(`Built _site/ with ${ITEMS.length} items`);
}

build();
