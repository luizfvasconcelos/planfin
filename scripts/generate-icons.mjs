/**
 * Generates placeholder PWA icons using only Node.js built-ins.
 * Run: node scripts/generate-icons.mjs
 *
 * For production, replace public/icon-192.png and public/icon-512.png
 * with proper branded icons.
 */
import { writeFileSync } from "fs"
import { createHash } from "crypto"

function createPNG(size, bgColor, textColor, label) {
  // We'll write a minimal PNG using raw bytes.
  // Since we can't use canvas without extra deps, we output a valid
  // solid-color PNG using pure Node.js.

  const width = size
  const height = size

  // Helper: CRC32
  const crcTable = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })()

  function crc32(buf) {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }

  function chunk(type, data) {
    const typeBuf = Buffer.from(type, "ascii")
    const lenBuf = Buffer.alloc(4)
    lenBuf.writeUInt32BE(data.length)
    const crcInput = Buffer.concat([typeBuf, data])
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc32(crcInput))
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
  }

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // Image data: solid color
  const [r, g, b] = bgColor
  const rawRows = []
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3)
    row[0] = 0 // filter type: None
    for (let x = 0; x < width; x++) {
      row[1 + x * 3] = r
      row[2 + x * 3] = g
      row[3 + x * 3] = b
    }
    rawRows.push(row)
  }
  const raw = Buffer.concat(rawRows)

  // zlib compress (deflate)
  const { deflateSync } = await import("zlib").catch(() => require("zlib"))
  // Fallback: use createDeflateRaw but simplest is sync
  const zlib = await import("zlib")
  const compressed = zlib.deflateSync(raw)

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ])

  return png
}

// Blue background [37, 99, 235] = tailwind blue-600
const blue = [37, 99, 235]

const { deflateSync } = (await import("zlib"))

function solidPNG(size, [r, g, b]) {
  const width = size
  const height = size

  const crcTable = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })()

  function crc32(buf) {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }

  function chunk(type, data) {
    const typeBuf = Buffer.from(type, "ascii")
    const lenBuf = Buffer.alloc(4)
    lenBuf.writeUInt32BE(data.length)
    const crcInput = Buffer.concat([typeBuf, data])
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc32(crcInput))
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 2

  const rows = []
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3)
    row[0] = 0
    for (let x = 0; x < width; x++) {
      row[1 + x * 3] = r
      row[2 + x * 3] = g
      row[3 + x * 3] = b
    }
    rows.push(row)
  }

  const compressed = deflateSync(Buffer.concat(rows))

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

writeFileSync("public/icon-192.png", solidPNG(192, blue))
writeFileSync("public/icon-512.png", solidPNG(512, blue))
console.log("Icons generated: public/icon-192.png, public/icon-512.png")
console.log("Replace with branded icons before production.")
