export const invoicePdfStyles = `
  :root {
    --gray-50: #f9fafb;
    --gray-100: #f3f4f6;
    --gray-200: #e5e7eb;
    --gray-400: #9ca3af;
    --gray-500: #6b7280;
    --gray-600: #4b5563;
    --gray-700: #374151;
    --gray-800: #1f2937;
    --gray-900: #111827;
    --green-600: #16a34a;
    --red-600: #dc2626;
  }

  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
    background: #ffffff;
    color: var(--gray-800);
  }

  .font-sans { font-family: inherit; }
  .text-xs { font-size: 0.75rem; line-height: 1rem; }
  .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
  .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
  .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
  .text-2xl { font-size: 1.5rem; line-height: 2rem; }
  .text-right { text-align: right; }
  .text-left { text-align: left; }
  .text-center { text-align: center; }
  .text-white { color: #ffffff; }
  .text-gray-900 { color: var(--gray-900); }
  .text-gray-800 { color: var(--gray-800); }
  .text-gray-700 { color: var(--gray-700); }
  .text-gray-600 { color: var(--gray-600); }
  .text-gray-500 { color: var(--gray-500); }
  .text-gray-400 { color: var(--gray-400); }
  .text-green-600 { color: var(--green-600); }
  .text-red-600 { color: var(--red-600); }
  .font-medium { font-weight: 500; }
  .font-semibold { font-weight: 600; }
  .font-bold { font-weight: 700; }
  .uppercase { text-transform: uppercase; }
  .tracking-wide { letter-spacing: 0.025em; }
  .tracking-wider { letter-spacing: 0.05em; }
  .italic { font-style: italic; }

  .bg-white { background-color: #ffffff; }
  .bg-gray-900 { background-color: var(--gray-900); }
  .bg-gray-100 { background-color: var(--gray-100); }
  .bg-gray-50 { background-color: var(--gray-50); }

  .border { border: 1px solid var(--gray-200); }
  .border-gray-100 { border-color: var(--gray-100); }
  .border-gray-200 { border-color: var(--gray-200); }
  .border-b { border-bottom: 1px solid var(--gray-200); }
  .border-t { border-top: 1px solid var(--gray-200); }

  .rounded { border-radius: 0.25rem; }
  .rounded-lg { border-radius: 0.5rem; }
  .rounded-full { border-radius: 9999px; }
  .overflow-hidden { overflow: hidden; }

  .p-3 { padding: 0.75rem; }
  .p-4 { padding: 1rem; }
  .p-8 { padding: 2rem; }
  .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
  .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
  .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
  .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
  .pt-2 { padding-top: 0.5rem; }
  .pt-4 { padding-top: 1rem; }
  .pb-2 { padding-bottom: 0.5rem; }
  .pb-6 { padding-bottom: 1.5rem; }

  .mt-2 { margin-top: 0.5rem; }
  .mt-4 { margin-top: 1rem; }
  .mt-6 { margin-top: 1.5rem; }
  .mb-1 { margin-bottom: 0.25rem; }
  .mb-2 { margin-bottom: 0.5rem; }
  .mb-6 { margin-bottom: 1.5rem; }
  .mb-8 { margin-bottom: 2rem; }
  .mx-auto { margin-left: auto; margin-right: auto; }

  .max-w-4xl { max-width: 56rem; }
  .w-full { width: 100%; }
  .w-12 { width: 3rem; }
  .w-1\\/2 { width: 50%; }
  .h-1 { height: 0.25rem; }
  .h-10 { height: 2.5rem; }

  .flex { display: flex; }
  .items-center { align-items: center; }
  .justify-between { justify-content: space-between; }
  .justify-end { justify-content: flex-end; }

  .border-collapse { border-collapse: collapse; }

  .space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem; }
  .space-y-3 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.75rem; }
`;
