// Confere o conteúdo real do arquivo enviado (assinatura nos primeiros bytes), não só a extensão.
// Impede, por exemplo, um HTML ou executável renomeado para .pdf.

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

const ZIP = [0x50, 0x4b, 0x03, 0x04]; // docx, xlsx, odt são pacotes zip
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // doc e xls antigos

// Texto puro: sem bytes de controle binários e sem marcação HTML/script
function isPlainText(buf: Buffer): boolean {
  const sample = buf.subarray(0, 64 * 1024);
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 0x09 || (b > 0x0d && b < 0x20 && b !== 0x1b)) return false;
  }
  const head = sample.toString('utf8').toLowerCase();
  return !/<\s*(script|html|svg|iframe|object|embed|body|meta)\b/.test(head);
}

export function hasValidSignature(ext: string, buf: Buffer): boolean {
  switch (ext) {
    case '.pdf':
      return startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    case '.png':
      return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case '.jpg':
    case '.jpeg':
      return startsWith(buf, [0xff, 0xd8, 0xff]);
    case '.webp':
      return startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8); // RIFF....WEBP
    case '.docx':
    case '.xlsx':
    case '.odt':
      return startsWith(buf, ZIP);
    case '.doc':
    case '.xls':
      return startsWith(buf, OLE);
    case '.rtf':
      return startsWith(buf, [0x7b, 0x5c, 0x72, 0x74, 0x66]); // {\rtf
    case '.csv':
    case '.txt':
      return isPlainText(buf);
    default:
      return false;
  }
}
