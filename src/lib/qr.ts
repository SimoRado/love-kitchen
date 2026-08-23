/**
 * Lightweight pure TypeScript QR Code SVG generator
 * Generates standards-compliant QR Code SVGs without external dependencies or network requests.
 */

// Simple byte-mode QR Code encoder (Version 1-10 with ECC Level M)
type QRVersion = 1 | 2 | 3 | 4 | 5 | 6;

// Capacity table for Byte mode, ECC Level M
const CAPACITIES: Record<QRVersion, number> = {
  1: 14,
  2: 26,
  3: 42,
  4: 62,
  5: 84,
  6: 106,
};

// Log and Anti-Log tables for Galois Field GF(256) with primitive polynomial 0x11d
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_EXP[i + 255] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

function gfPolyMul(p: number[], q: number[]): number[] {
  const result = new Array(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      result[i + j] ^= gfMul(p[i], q[j]);
    }
  }
  return result;
}

function getGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    poly = gfPolyMul(poly, [1, GF_EXP[i]]);
  }
  return poly;
}

function computeECC(data: number[], eccCount: number): number[] {
  const genPoly = getGeneratorPoly(eccCount);
  const info = [...data, ...new Array(eccCount).fill(0)];

  for (let i = 0; i < data.length; i++) {
    const factor = info[i];
    if (factor !== 0) {
      for (let j = 0; j < genPoly.length; j++) {
        info[i + j] ^= gfMul(genPoly[j], factor);
      }
    }
  }
  return info.slice(data.length);
}

// ECC specs for Level M: [totalCodewords, eccCodewordsPerBlock, numBlocks]
const ECC_SPECS: Record<QRVersion, [number, number, number]> = {
  1: [26, 10, 1],
  2: [44, 16, 1],
  3: [70, 26, 1],
  4: [100, 18, 2],
  5: [134, 24, 2],
  6: [172, 16, 4],
};

function getVersionForLength(byteLength: number): QRVersion {
  for (const v of [1, 2, 3, 4, 5, 6] as QRVersion[]) {
    if (byteLength <= CAPACITIES[v]) return v;
  }
  return 6;
}

function encodeData(text: string, version: QRVersion): number[] {
  const utf8 = new TextEncoder().encode(text);
  const [totalCodewords, eccCodewords, numBlocks] = ECC_SPECS[version];
  const dataCapacity = totalCodewords - eccCodewords * numBlocks;

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  // Mode: Byte (0100)
  pushBits(0b0100, 4);
  // Character count indicator (8 bits for version 1-9)
  pushBits(utf8.length, 8);
  // Data
  for (const byte of utf8) pushBits(byte, 8);
  // Terminator
  const terminatorLen = Math.min(4, dataCapacity * 8 - bits.length);
  pushBits(0, terminatorLen);
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Pad bytes: 0xEC, 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < dataCapacity * 8) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to bytes
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    dataBytes.push(byte);
  }

  // Generate ECC bytes
  const blockSize = Math.floor(dataBytes.length / numBlocks);
  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];

  for (let b = 0; b < numBlocks; b++) {
    const blockData = dataBytes.slice(b * blockSize, (b + 1) * blockSize);
    dataBlocks.push(blockData);
    eccBlocks.push(computeECC(blockData, eccCodewords));
  }

  // Interleave data and ECC
  const finalCodewords: number[] = [];
  for (let i = 0; i < blockSize; i++) {
    for (let b = 0; b < numBlocks; b++) {
      finalCodewords.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < eccCodewords; i++) {
    for (let b = 0; b < numBlocks; b++) {
      finalCodewords.push(eccBlocks[b][i]);
    }
  }

  return finalCodewords;
}

// Module matrix generation
export function generateQRMatrix(text: string): boolean[][] {
  const version = getVersionForLength(new TextEncoder().encode(text).length);
  const size = 17 + version * 4;
  const matrix: Array<Array<boolean | null>> = Array.from({ length: size }, () =>
    new Array(size).fill(null)
  );

  // 1. Finder patterns
  const addFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (
            (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            matrix[nr][nc] = true;
          } else {
            matrix[nr][nc] = false;
          }
        }
      }
    }
  };

  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // 3. Dark module and reserved format regions
  matrix[size - 8][8] = true;

  // Reserve format info areas
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = size - 8; i < size; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }

  // 4. Alignment patterns for version >= 2
  if (version >= 2) {
    const alignPos = version === 2 ? [6, 18] : version === 3 ? [6, 22] : version === 4 ? [6, 26] : version === 5 ? [6, 30] : [6, 34];
    for (const r of alignPos) {
      for (const c of alignPos) {
        if (matrix[r][c] !== null) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            matrix[r + dr][c + dc] =
              Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
          }
        }
      }
    }
  }

  // 5. Place data bits
  const codewords = encodeData(text, version);
  const dataBits: number[] = [];
  for (const byte of codewords) {
    for (let i = 7; i >= 0; i--) dataBits.push((byte >> i) & 1);
  }

  let bitIdx = 0;
  let dir = -1;
  let col = size - 1;

  while (col > 0) {
    if (col === 6) col--; // Skip vertical timing column
    const rows = dir === -1
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (matrix[row][c] === null) {
          const bit = bitIdx < dataBits.length ? dataBits[bitIdx++] : 0;
          // Apply standard mask pattern 0: (row + col) % 2 == 0
          const mask = (row + c) % 2 === 0;
          matrix[row][c] = (bit === 1) !== mask;
        }
      }
    }
    dir = -dir;
    col -= 2;
  }

  // 6. Add Format Information (ECC Level M = 00, Mask 0 = 000 -> Format Bits: 101010000010010)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1;
  matrix[8][7] = formatBits[6] === 1;
  matrix[8][8] = formatBits[7] === 1;
  matrix[7][8] = formatBits[8] === 1;
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i] === 1;

  for (let i = 0; i < 8; i++) matrix[size - 1 - i][8] = formatBits[i] === 1;
  for (let i = 8; i < 15; i++) matrix[8][size - 15 + i] = formatBits[i] === 1;

  return matrix.map((row) => row.map((cell) => Boolean(cell)));
}

/**
 * Returns an SVG string of the QR code.
 */
export function generateQRSvg(text: string, size = 240, darkColor = "#0f172a", lightColor = "#ffffff"): string {
  const matrix = generateQRMatrix(text);
  const count = matrix.length;
  const margin = 2;
  const total = count + margin * 2;
  const cellSize = size / total;

  let paths = "";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (matrix[r][c]) {
        const x = (c + margin) * cellSize;
        const y = (r + margin) * cellSize;
        paths += `M${x.toFixed(2)},${y.toFixed(2)}h${cellSize.toFixed(2)}v${cellSize.toFixed(2)}h-${cellSize.toFixed(2)}z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">
    <rect width="${size}" height="${size}" fill="${lightColor}" rx="12" />
    <path d="${paths}" fill="${darkColor}" />
  </svg>`;
}
