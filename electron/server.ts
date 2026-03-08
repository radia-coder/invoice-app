import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PORT } from './config';

let serverProcess: ChildProcess | null = null;

function findServerJs(baseDir: string): string | null {
  // Direct path (packaged app)
  const direct = path.join(baseDir, 'server.js');
  if (fs.existsSync(direct)) return direct;

  // Next.js standalone mirrors the full project path inside standalone/
  // e.g. .next/standalone/Downloads/invoice Final V5 /server.js
  function walk(dir: string, depth = 0): string | null {
    if (depth > 6) return null;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name === 'server.js') {
          const full = path.join(dir, entry.name);
          // Make sure it is the Next.js server, not a node_modules one
          if (!full.includes('node_modules')) return full;
        }
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          const found = walk(path.join(dir, entry.name), depth + 1);
          if (found) return found;
        }
      }
    } catch { /* skip unreadable dirs */ }
    return null;
  }

  return walk(baseDir);
}

function getServerPath(): string {
  // In packaged app — resources/app/.next/standalone
  const resourcesBase = process.resourcesPath
    ?? path.join(__dirname, '..', 'resources');
  const bundledBase = path.join(resourcesBase, 'app', '.next', 'standalone');

  // In dev/build mode — project root/.next/standalone
  const devBase = path.join(__dirname, '..', '..', '.next', 'standalone');

  for (const base of [bundledBase, devBase]) {
    if (fs.existsSync(base)) {
      const found = findServerJs(base);
      if (found) {
        console.log('[Server] Found server.js at:', found);
        return found;
      }
    }
  }

  throw new Error('Cannot find Next.js standalone server.js — did you run npm run build:next?');
}

export function startServer(): ChildProcess {
  const serverPath = getServerPath();
  const serverDir = path.dirname(serverPath);

  console.log('[Server] Starting Next.js at:', serverPath);

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout?.on('data', (data) => {
    process.stdout.write(`[Next] ${data}`);
  });

  serverProcess.stderr?.on('data', (data) => {
    process.stderr.write(`[Next] ${data}`);
  });

  serverProcess.on('exit', (code) => {
    console.log(`[Server] Process exited with code ${code}`);
    serverProcess = null;
  });

  return serverProcess;
}

export async function waitForServer(timeoutMs = 45000): Promise<void> {
  const url = `http://localhost:${PORT}/api/health`;
  const deadline = Date.now() + timeoutMs;

  console.log('[Server] Waiting for Next.js to be ready...');

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        console.log('[Server] Next.js is ready.');
        return;
      }
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Next.js did not become ready within ${timeoutMs}ms`);
}

export function stopServer(): void {
  if (serverProcess && !serverProcess.killed) {
    console.log('[Server] Stopping Next.js server...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}
