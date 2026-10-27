const fs = require('fs');
const path = require('path');

function createFavicon() {
  const width = 16;
  const height = 16;
  const xorSize = width * height * 4; // 1024 bytes
  const andRowBytes = 4; // 16 bits = 2 bytes, padded to 4 bytes (DWORD aligned)
  const andSize = andRowBytes * height; // 64 bytes
  const dibHeaderSize = 40;
  const imageSize = dibHeaderSize + xorSize + andSize; // 1128 bytes
  const fileHeaderSize = 6;
  const dirEntrySize = 16;
  const dataOffset = fileHeaderSize + dirEntrySize; // 22 bytes
  const totalFileSize = dataOffset + imageSize;

  const buf = Buffer.alloc(totalFileSize);

  // 1. ICO File Header
  buf.writeUInt16LE(0, 0); // Reserved
  buf.writeUInt16LE(1, 2); // 1 = ICO
  buf.writeUInt16LE(1, 4); // 1 image

  // 2. Directory Entry
  buf.writeUInt8(width, 6);
  buf.writeUInt8(height, 7);
  buf.writeUInt8(0, 8); // Color palette
  buf.writeUInt8(0, 9); // Reserved
  buf.writeUInt16LE(1, 10); // Color planes
  buf.writeUInt16LE(32, 12); // Bits per pixel
  buf.writeUInt32LE(imageSize, 14); // Image data size
  buf.writeUInt32LE(dataOffset, 18); // Offset to image data

  // 3. BITMAPINFOHEADER (DIB Header)
  let offset = dataOffset;
  buf.writeUInt32LE(40, offset); // biSize
  buf.writeInt32LE(width, offset + 4); // biWidth
  buf.writeInt32LE(height * 2, offset + 8); // biHeight (doubled for ICO mask)
  buf.writeUInt16LE(1, offset + 12); // biPlanes
  buf.writeUInt16LE(32, offset + 14); // biBitCount
  buf.writeUInt32LE(0, offset + 16); // biCompression (BI_RGB)
  buf.writeUInt32LE(xorSize, offset + 20); // biSizeImage
  buf.writeInt32LE(0, offset + 24); // biXPelsPerMeter
  buf.writeInt32LE(0, offset + 28); // biYPelsPerMeter
  buf.writeUInt32LE(0, offset + 32); // biClrUsed
  buf.writeUInt32LE(0, offset + 36); // biClrImportant
  offset += 40;

  // 4. XOR Bitmap Data (bottom-to-top, BGRA)
  // Draw a medical cross icon with blue circular background
  const xorStart = offset;
  for (let y = 0; y < height; y++) {
    // BMP is stored bottom row to top row:
    // row 0 is the bottom row of visual icon, row 15 is top
    const visualY = (height - 1) - y;
    for (let visualX = 0; visualX < width; visualX++) {
      const pixelOffset = xorStart + (y * width + visualX) * 4;
      const dx = visualX - 7.5;
      const dy = visualY - 7.5;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check if inside circular icon (radius ~ 7)
      if (dist <= 7.0) {
        // Check if inside medical cross:
        // Horizontal bar: visualY in [6, 9], visualX in [4, 11]
        // Vertical bar: visualX in [6, 9], visualY in [4, 11]
        const inHBar = (visualY >= 6 && visualY <= 9 && visualX >= 4 && visualX <= 11);
        const inVBar = (visualX >= 6 && visualX <= 9 && visualY >= 4 && visualY <= 11);

        if (inHBar || inVBar) {
          // White cross (#ffffff)
          buf.writeUInt8(255, pixelOffset);     // B
          buf.writeUInt8(255, pixelOffset + 1); // G
          buf.writeUInt8(255, pixelOffset + 2); // R
          buf.writeUInt8(255, pixelOffset + 3); // A
        } else {
          // Deep Blue circle (#2563eb)
          buf.writeUInt8(0xeb, pixelOffset);     // B
          buf.writeUInt8(0x63, pixelOffset + 1); // G
          buf.writeUInt8(0x25, pixelOffset + 2); // R
          buf.writeUInt8(255,  pixelOffset + 3); // A
        }
      } else {
        // Transparent
        buf.writeUInt32LE(0, pixelOffset);
      }
    }
  }
  offset += xorSize;

  // 5. AND Mask (1 bit per pixel, bottom-to-top, 0 = opaque, 1 = transparent)
  const andStart = offset;
  for (let y = 0; y < height; y++) {
    const visualY = (height - 1) - y;
    let rowMask = 0;
    for (let visualX = 0; visualX < width; visualX++) {
      const dx = visualX - 7.5;
      const dy = visualY - 7.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 7.0) {
        // transparent bit is 1
        rowMask |= (1 << (15 - visualX));
      }
    }
    const rowOffset = andStart + y * andRowBytes;
    buf.writeUInt16BE(rowMask, rowOffset);
    buf.writeUInt16LE(0, rowOffset + 2); // 2 bytes padding to DWORD
  }

  const outPath = path.join(__dirname, '..', '..', 'frontend', 'favicon.ico');
  fs.writeFileSync(outPath, buf);
  console.log(`Favicon created successfully at: ${outPath} (${buf.length} bytes)`);
}

createFavicon();
