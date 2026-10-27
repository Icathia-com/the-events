// Checks js/qr.js by decoding what it draws with jsQR, across every version it supports.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jsQRModule from 'jsqr';
import { qrMatrix } from '../js/qr.js';

const jsQR = jsQRModule.default || jsQRModule;

// Renders the matrix as black-on-white pixels with a quiet zone, then decodes it.
function decode(matrix, scale = 4, quiet = 4) {
  const width = (matrix.length + quiet * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (!dark) return;
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const i = (((y + quiet) * scale + dy) * width + (x + quiet) * scale + dx) * 4;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
      }
    }
  }));
  const result = jsQR(pixels, width, width);
  return result && Buffer.from(result.binaryData).toString('utf8');
}

describe('QR codes', () => {
  const texts = [
    'TE1:sample-meilin',
    'TE1:JGCKYCvmtOoD34spMNssOl378nXW:yishun',
    'https://icathia-com.github.io/the-events/verify.html?ref=VN-2026-00482',
    'Kopi, teh and 你好 é',
  ];
  // Each version's largest text, and one byte more (which needs the next version).
  for (const n of [1, 14, 15, 26, 27, 42, 43, 62, 63, 84, 85, 106, 107, 122, 123, 152, 153, 180, 181, 213]) {
    texts.push('x'.repeat(n));
  }

  for (const text of texts) {
    it(`decodes back to the same ${text.length}-character text`, () => {
      assert.equal(decode(qrMatrix(text)), text);
    });
  }

  it('sizes the code to fit: 21 modules for short text, 57 for the longest', () => {
    assert.equal(qrMatrix('x').length, 21);
    assert.equal(qrMatrix('x'.repeat(213)).length, 57);
  });

  it('refuses text longer than version 10 holds', () => {
    assert.throws(() => qrMatrix('x'.repeat(214)));
  });
});
