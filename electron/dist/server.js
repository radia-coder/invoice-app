"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
exports.waitForServer = waitForServer;
exports.stopServer = stopServer;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("./config");
let serverProcess = null;
function findServerJs(baseDir) {
    // Direct path (packaged app)
    const direct = path_1.default.join(baseDir, 'server.js');
    if (fs_1.default.existsSync(direct))
        return direct;
    // Next.js standalone mirrors the full project path inside standalone/
    // e.g. .next/standalone/Downloads/invoice Final V5 /server.js
    function walk(dir, depth = 0) {
        if (depth > 6)
            return null;
        try {
            const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isFile() && entry.name === 'server.js') {
                    const full = path_1.default.join(dir, entry.name);
                    // Make sure it is the Next.js server, not a node_modules one
                    if (!full.includes('node_modules'))
                        return full;
                }
                if (entry.isDirectory() && entry.name !== 'node_modules') {
                    const found = walk(path_1.default.join(dir, entry.name), depth + 1);
                    if (found)
                        return found;
                }
            }
        }
        catch { /* skip unreadable dirs */ }
        return null;
    }
    return walk(baseDir);
}
function getServerPath() {
    // In packaged app — resources/app/.next/standalone
    const resourcesBase = process.resourcesPath
        ?? path_1.default.join(__dirname, '..', 'resources');
    const bundledBase = path_1.default.join(resourcesBase, 'app', '.next', 'standalone');
    // In dev/build mode — project root/.next/standalone
    const devBase = path_1.default.join(__dirname, '..', '..', '.next', 'standalone');
    for (const base of [bundledBase, devBase]) {
        if (fs_1.default.existsSync(base)) {
            const found = findServerJs(base);
            if (found) {
                console.log('[Server] Found server.js at:', found);
                return found;
            }
        }
    }
    throw new Error('Cannot find Next.js standalone server.js — did you run npm run build:next?');
}
function startServer() {
    const serverPath = getServerPath();
    const serverDir = path_1.default.dirname(serverPath);
    console.log('[Server] Starting Next.js at:', serverPath);
    serverProcess = (0, child_process_1.spawn)(process.execPath, [serverPath], {
        cwd: serverDir,
        env: {
            ...process.env,
            PORT: String(config_1.PORT),
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
async function waitForServer(timeoutMs = 45000) {
    const url = `http://localhost:${config_1.PORT}/api/health`;
    const deadline = Date.now() + timeoutMs;
    console.log('[Server] Waiting for Next.js to be ready...');
    while (Date.now() < deadline) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
            if (res.ok) {
                console.log('[Server] Next.js is ready.');
                return;
            }
        }
        catch {
            // not ready yet
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Next.js did not become ready within ${timeoutMs}ms`);
}
function stopServer() {
    if (serverProcess && !serverProcess.killed) {
        console.log('[Server] Stopping Next.js server...');
        serverProcess.kill('SIGTERM');
        serverProcess = null;
    }
}
//# sourceMappingURL=server.js.map