import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("/Users/moriyuuta/Latex_gui/frontend/app/icon.svg");

async function renderPng(size) {
  return sharp(svg, { density: 512 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// Apple touch icon (180x180) — iOS home screen
const apple = await renderPng(180);
writeFileSync("/Users/moriyuuta/Latex_gui/frontend/app/apple-icon.png", apple);
console.log("apple-icon.png:", apple.length, "bytes");

// Open Graph image (1200x630) - no we don't need this, skip

// Favicon ICO — write 32x32 PNG as `.ico`-compatible (browsers accept PNG-in-ICO)
// For proper multi-size ICO, we need manual construction. Let's write just 32x32 PNG
// and name it .ico. Modern browsers accept this. Also write a 48x48 for taskbar clarity.
const png32 = await renderPng(32);

// Build an ICO file with a 32x32 PNG entry
// ICO header: 6 bytes + 16-byte entry per image
// Using PNG embedded ICO (supported by all modern browsers incl. IE6+ on Vista+)
function buildIco(pngSize, pngBytes) {
  const headerSize = 6;
  const entrySize = 16;
  const buf = Buffer.alloc(headerSize + entrySize + pngBytes.length);
  // Header
  buf.writeUInt16LE(0, 0);          // reserved
  buf.writeUInt16LE(1, 2);          // type=1 (icon)
  buf.writeUInt16LE(1, 4);          // count=1
  // Entry
  buf.writeUInt8(pngSize === 256 ? 0 : pngSize, 6);   // width (0 means 256)
  buf.writeUInt8(pngSize === 256 ? 0 : pngSize, 7);   // height
  buf.writeUInt8(0, 8);             // color palette (0 = no palette)
  buf.writeUInt8(0, 9);             // reserved
  buf.writeUInt16LE(1, 10);         // color planes
  buf.writeUInt16LE(32, 12);        // bits per pixel
  buf.writeUInt32LE(pngBytes.length, 14);             // image size
  buf.writeUInt32LE(headerSize + entrySize, 18);      // image offset
  pngBytes.copy(buf, headerSize + entrySize);
  return buf;
}
const ico = buildIco(32, png32);
writeFileSync("/Users/moriyuuta/Latex_gui/frontend/app/favicon.ico", ico);
console.log("favicon.ico:", ico.length, "bytes");

