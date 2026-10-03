// Print software reads a PNG's physical size from its pHYs chunk, so write the real DPI
// into the file. Without it, RIPs and Photoshop assume 72 DPI and show the wrong size.

let table: Uint32Array | undefined;

function crc32(bytes: Uint8Array) {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of bytes) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export async function withPngDpi(blob: Blob, dpi: number) {
  const src = new Uint8Array(await blob.arrayBuffer());
  const IHDR_END = 33; // 8-byte signature + 25-byte IHDR chunk
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  const ppm = Math.round(dpi / 0.0254);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, ppm);
  view.setUint32(12, ppm);
  chunk[16] = 1; // unit: metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)));

  const out = new Uint8Array(src.length + chunk.length);
  out.set(src.subarray(0, IHDR_END));
  out.set(chunk, IHDR_END);
  out.set(src.subarray(IHDR_END), IHDR_END + chunk.length);
  return new Blob([out], { type: "image/png" });
}
