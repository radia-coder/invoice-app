"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose a minimal, safe API to the renderer process
electron_1.contextBridge.exposeInMainWorld('electronApp', {
    platform: process.platform,
    isElectron: true,
    // Open WhatsApp macOS app — copies invoice PDF to clipboard, then opens chat
    openWhatsApp: (phone, invoiceId, text) => electron_1.ipcRenderer.invoke('open-whatsapp', { phone, invoiceId, text }),
    // Reveal the invoice PDF in Finder
    showPdfInFinder: (invoiceId) => electron_1.ipcRenderer.invoke('show-pdf-in-finder', { invoiceId }),
});
//# sourceMappingURL=preload.js.map