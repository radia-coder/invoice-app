"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showSplash = showSplash;
exports.hideSplash = hideSplash;
const electron_1 = require("electron");
let splashWindow = null;
function showSplash() {
    splashWindow = new electron_1.BrowserWindow({
        width: 400,
        height: 280,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        backgroundColor: '#09090b',
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: #09090b;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            gap: 24px;
            -webkit-app-region: drag;
            user-select: none;
          }
          .logo {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
            color: #7a67e7;
          }
          .subtitle {
            font-size: 13px;
            color: #71717a;
            margin-top: -16px;
          }
          .spinner {
            width: 28px;
            height: 28px;
            border: 2px solid #27272a;
            border-top-color: #7a67e7;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          .message {
            font-size: 12px;
            color: #52525b;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="logo">Invoice Manager</div>
        <div class="subtitle">Trucking Settlement System</div>
        <div class="spinner"></div>
        <div class="message" id="msg">Starting...</div>
        <script>
          const messages = [
            'Starting server...',
            'Loading database...',
            'Almost ready...'
          ];
          let i = 0;
          setInterval(() => {
            i = (i + 1) % messages.length;
            document.getElementById('msg').textContent = messages[i];
          }, 1800);
        </script>
      </body>
    </html>
  `;
    splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    splashWindow.once('ready-to-show', () => splashWindow?.show());
    return splashWindow;
}
function hideSplash() {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
    }
}
//# sourceMappingURL=splash.js.map