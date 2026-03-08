import { contextBridge, ipcRenderer } from 'electron';

// Expose a minimal, safe API to the renderer process
contextBridge.exposeInMainWorld('electronApp', {
  platform: process.platform,
  isElectron: true,
  // Open WhatsApp macOS app — copies invoice PDF to clipboard, then opens chat
  openWhatsApp: (phone: string, invoiceId: number, text: string) =>
    ipcRenderer.invoke('open-whatsapp', { phone, invoiceId, text }),
  // Reveal the invoice PDF in Finder
  showPdfInFinder: (invoiceId: number) =>
    ipcRenderer.invoke('show-pdf-in-finder', { invoiceId }),
  // Auto-updater
  onUpdateAvailable: (cb: () => void) => ipcRenderer.on('update-available', cb),
  onUpdateDownloaded: (cb: () => void) => ipcRenderer.on('update-downloaded', cb),
  installUpdate: () => ipcRenderer.send('install-update'),
});
