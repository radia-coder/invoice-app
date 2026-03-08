/**
 * After next build, copies static assets into the standalone directory so the
 * embedded Next.js server can serve CSS/JS/images without a CDN.
 * Run automatically by `npm run build:next`.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Find the standalone server directory (it mirrors the full path on disk)
function findStandaloneDir(base) {
  if (!fs.existsSync(base)) {
    console.error('Standalone directory not found:', base);
    process.exit(1);
  }
  // Walk to find the directory containing server.js
  function walk(dir, depth = 0) {
    if (depth > 6) return null;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isFile() && e.name === 'server.js') return dir;
        if (e.isDirectory() && e.name !== 'node_modules') {
          const found = walk(path.join(dir, e.name), depth + 1);
          if (found) return found;
        }
      }
    } catch { /* skip */ }
    return null;
  }
  return walk(base);
}

const standaloneBase = path.join(ROOT, '.next', 'standalone');
const serverDir = findStandaloneDir(standaloneBase);
if (!serverDir) {
  console.error('Could not find server.js inside .next/standalone');
  process.exit(1);
}

// Copy .next/static → {serverDir}/.next/static
const staticSrc = path.join(ROOT, '.next', 'static');
const staticDst = path.join(serverDir, '.next', 'static');
fs.cpSync(staticSrc, staticDst, { recursive: true });
console.log('Copied .next/static →', path.relative(ROOT, staticDst));

// Copy public → {serverDir}/public
const publicSrc = path.join(ROOT, 'public');
const publicDst = path.join(serverDir, 'public');
if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, publicDst, { recursive: true });
  console.log('Copied public →', path.relative(ROOT, publicDst));
}

console.log('Standalone assets ready.');
