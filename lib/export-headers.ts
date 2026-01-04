export type NonByteStringHit = {
  index: number;
  codePoint: number;
  char: string;
};

export function findNonByteStringChar(value: string): NonByteStringHit | null {
  for (let i = 0; i < value.length; i++) {
    const codePoint = value.charCodeAt(i);
    if (codePoint > 255) {
      return { index: i, codePoint, char: value[i] };
    }
  }
  return null;
}

export function sanitizeHeaderValue(value: string): string {
  let sanitized = '';
  for (let i = 0; i < value.length; i++) {
    const codePoint = value.charCodeAt(i);
    if (codePoint === 10 || codePoint === 13) {
      sanitized += ' ';
      continue;
    }
    if (codePoint > 255) {
      sanitized += '?';
      continue;
    }
    sanitized += value[i];
  }
  return sanitized;
}

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export function sanitizeFilename(value: string): string {
  const cleaned = value.replace(/[\\/\r\n"]/g, '_');
  const sanitized = sanitizeHeaderValue(cleaned).trim();
  return sanitized || 'download';
}

export function buildContentDisposition(filename: string): string {
  const fallback = sanitizeFilename(filename);
  const encoded = encodeRfc5987Value(filename);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
