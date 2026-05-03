/**
 * scripts/gen_sounds.js
 *
 * Generates three satisfying chime/ding WAV files for StreakBoard habit sounds.
 * Run with: node scripts/gen_sounds.js
 *
 * Technique:
 *   - Multi-harmonic synthesis (fundamental + 2nd + 3rd) for chime quality
 *   - Exponential decay envelope (like a real bell/chime, not a flat beep)
 *   - 5ms linear fade-in to eliminate click/pop at note start
 *   - 22050 Hz, 16-bit, mono WAV — high enough quality, small file size
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const BIT_DEPTH   = 16;
const CHANNELS    = 1;
const OUT_DIR     = path.join(__dirname, '../assets/sounds');

// ── Note frequencies (equal temperament) ─────────────────────────────────────
const FREQ = {
  C4: 261.63,
  E4: 329.63,
  G4: 392.00,
  B4: 493.88,
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
  B5: 987.77,
  C6: 1046.50,
};

/**
 * Generate a single chime tone with harmonics + exponential decay.
 *
 * @param {number} freq        Fundamental frequency in Hz
 * @param {number} durationMs  Total note duration in milliseconds
 * @param {number} decayHalf   Time (ms) for amplitude to halve (controls decay speed)
 * @param {number} fadeInMs    Linear fade-in length in ms (removes click)
 * @param {number} volume      Peak amplitude 0–1
 * @returns {Float64Array}     Normalised samples (-1 to +1)
 */
function tone(freq, durationMs, { decayHalf = 180, fadeInMs = 4, volume = 0.82 } = {}) {
  const n         = Math.floor(SAMPLE_RATE * durationMs / 1000);
  const fadeIn    = Math.floor(SAMPLE_RATE * fadeInMs  / 1000);
  const k         = Math.log(0.5) / (SAMPLE_RATE * decayHalf / 1000); // decay constant
  const samples   = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    // Exponential decay envelope — starts at 1, halves every decayHalf ms
    const env = Math.exp(k * i);

    // Linear fade-in to kill the initial click
    const fade = i < fadeIn ? i / fadeIn : 1.0;

    // Multi-harmonic sine mix: fundamental (strong) + overtones (warmth/brightness)
    const t = i / SAMPLE_RATE;
    const wave =
      0.65 * Math.sin(2 * Math.PI * freq       * t) +  // fundamental
      0.22 * Math.sin(2 * Math.PI * freq * 2   * t) +  // 2nd harmonic (octave)
      0.09 * Math.sin(2 * Math.PI * freq * 3   * t) +  // 3rd harmonic
      0.04 * Math.sin(2 * Math.PI * freq * 4   * t);   // 4th harmonic (shimmer)

    samples[i] = wave * env * fade * volume;
  }
  return samples;
}

/**
 * Concatenate Float64Array segments with a small crossfade/silence gap.
 *
 * @param {Array<{samples: Float64Array, gapMs?: number}>} parts
 * @returns {Float64Array}
 */
function concat(parts) {
  const arrays = [];
  for (const { samples, gapMs = 0 } of parts) {
    arrays.push(samples);
    if (gapMs > 0) {
      arrays.push(new Float64Array(Math.floor(SAMPLE_RATE * gapMs / 1000)));
    }
  }
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out   = new Float64Array(total);
  let offset  = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

/**
 * Write a 16-bit PCM WAV file from a Float64Array of samples in [-1, +1].
 */
function writeWav(filename, samples) {
  // Clamp and convert to 16-bit signed integers
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = Math.round(clamped * 32767);
  }

  const dataBytes = pcm.length * 2;
  const buf       = Buffer.allocUnsafe(44 + dataBytes);

  // RIFF header
  buf.write('RIFF',                  0);
  buf.writeUInt32LE(36 + dataBytes,  4);
  buf.write('WAVE',                  8);

  // fmt sub-chunk
  buf.write('fmt ',                  12);
  buf.writeUInt32LE(16,              16);  // sub-chunk size (PCM)
  buf.writeUInt16LE(1,               20);  // audio format: PCM
  buf.writeUInt16LE(CHANNELS,        22);
  buf.writeUInt32LE(SAMPLE_RATE,     24);
  buf.writeUInt32LE(SAMPLE_RATE * CHANNELS * BIT_DEPTH / 8, 28); // byte rate
  buf.writeUInt16LE(CHANNELS * BIT_DEPTH / 8,               32); // block align
  buf.writeUInt16LE(BIT_DEPTH,       34);

  // data sub-chunk
  buf.write('data',                  36);
  buf.writeUInt32LE(dataBytes,       40);
  for (let i = 0; i < pcm.length; i++) {
    buf.writeInt16LE(pcm[i], 44 + i * 2);
  }

  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, buf);
  console.log(`✓  ${filename.padEnd(26)} ${(buf.length / 1024).toFixed(1)} KB`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sound definitions
// ─────────────────────────────────────────────────────────────────────────────

// 1. TICK — habit marked DONE: bright ascending two-tone chime (C5 → E5)
//    Total ≈ 520ms — satisfying but not intrusive
const tickSound = concat([
  { samples: tone(FREQ.C5, 180, { decayHalf: 80,  fadeInMs: 4, volume: 0.78 }) },
  { samples: tone(FREQ.E5, 340, { decayHalf: 200, fadeInMs: 4, volume: 0.82 }), gapMs: 0 },
]);

// 2. CROSS — habit unchecked / missed: gentle descending two-tone (E4 → C4)
//    Muted: lower volume, faster decay, no harsh overtones
const crossSound = concat([
  { samples: tone(FREQ.E4, 130, { decayHalf: 60,  fadeInMs: 5, volume: 0.55 }) },
  { samples: tone(FREQ.C4, 240, { decayHalf: 120, fadeInMs: 5, volume: 0.50 }), gapMs: 0 },
]);

// 3. STREAK MILESTONE — ascending major arpeggio (C5 → E5 → G5 → C6)
//    Celebratory: four tones, final note lingers
const streakSound = concat([
  { samples: tone(FREQ.C5, 100, { decayHalf: 60,  fadeInMs: 3, volume: 0.75 }) },
  { samples: tone(FREQ.E5, 100, { decayHalf: 70,  fadeInMs: 3, volume: 0.78 }) },
  { samples: tone(FREQ.G5, 100, { decayHalf: 80,  fadeInMs: 3, volume: 0.80 }) },
  { samples: tone(FREQ.C6, 650, { decayHalf: 280, fadeInMs: 3, volume: 0.85 }), gapMs: 0 },
]);

// ─────────────────────────────────────────────────────────────────────────────
// Write files
// ─────────────────────────────────────────────────────────────────────────────
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

console.log('\nGenerating StreakBoard sound effects...\n');
writeWav('tick.wav',             tickSound);
writeWav('cross.wav',            crossSound);
writeWav('streak_increase.wav',  streakSound);
console.log('\nDone. All sounds written to assets/sounds/\n');
