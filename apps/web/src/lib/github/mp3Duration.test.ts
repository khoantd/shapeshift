import { describe, expect, test } from "bun:test";
import {
  measureMp3DurationSeconds,
  resolveNarrationDurationSeconds,
} from "./mp3Duration";

/** Build a minimal CBR MPEG1 Layer III mono frame (silent payload). */
function buildMpeg1Layer3Frame(opts?: {
  bitrateKbps?: number;
  sampleRate?: 44100 | 48000 | 32000;
  padding?: 0 | 1;
}): Buffer {
  const bitrateKbps = opts?.bitrateKbps ?? 128;
  const sampleRate = opts?.sampleRate ?? 44100;
  const padding = opts?.padding ?? 0;
  const brTable = [
    0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
  ];
  const brIdx = brTable.indexOf(bitrateKbps);
  if (brIdx < 0) throw new Error("unsupported bitrate");
  const srIdx = sampleRate === 44100 ? 0 : sampleRate === 48000 ? 1 : 2;
  const frameLen =
    Math.floor((144 * bitrateKbps * 1000) / sampleRate) + padding;
  const frame = Buffer.alloc(frameLen, 0);
  frame[0] = 0xff;
  frame[1] = 0xfb; // MPEG1, Layer3, no CRC
  frame[2] = ((brIdx & 0x0f) << 4) | ((srIdx & 0x03) << 2) | (padding << 1);
  frame[3] = 0xc0; // mono
  return frame;
}

function buildCbrMp3(frameCount: number): Buffer {
  const frame = buildMpeg1Layer3Frame();
  return Buffer.concat(Array.from({ length: frameCount }, () => frame));
}

describe("measureMp3DurationSeconds", () => {
  test("measures CBR from frame count", () => {
    // 100 frames × 1152 samples @ 44100 ≈ 2.612s
    const buf = buildCbrMp3(100);
    const sec = measureMp3DurationSeconds(buf);
    expect(sec).not.toBeNull();
    expect(sec!).toBeCloseTo((100 * 1152) / 44100, 2);
  });

  test("skips ID3v2 preamble", () => {
    const frames = buildCbrMp3(50);
    const id3 = Buffer.alloc(20, 0);
    id3[0] = 0x49;
    id3[1] = 0x44;
    id3[2] = 0x33;
    id3[3] = 3;
    // synchsafe size = 10 (payload after header)
    id3[6] = 0;
    id3[7] = 0;
    id3[8] = 0;
    id3[9] = 10;
    const buf = Buffer.concat([id3, frames]);
    const sec = measureMp3DurationSeconds(buf);
    expect(sec!).toBeCloseTo((50 * 1152) / 44100, 2);
  });

  test("returns null for empty/non-mp3", () => {
    expect(measureMp3DurationSeconds(Buffer.alloc(0))).toBeNull();
    expect(measureMp3DurationSeconds(Buffer.from("not audio"))).toBeNull();
  });

  test("clamps to max 45s", () => {
    // ~2000 frames ≈ 52s before clamp
    const buf = buildCbrMp3(2000);
    expect(measureMp3DurationSeconds(buf)).toBe(45);
  });
});

describe("resolveNarrationDurationSeconds", () => {
  test("prefers measured mp3 over estimate", () => {
    const audio = buildCbrMp3(80);
    const measured = measureMp3DurationSeconds(audio)!;
    const resolved = resolveNarrationDurationSeconds({
      audio,
      text: "x".repeat(5000),
      estimateSpeechDurationSeconds: () => 40,
    });
    expect(resolved).toBeCloseTo(measured, 2);
  });

  test("falls back to estimate when audio empty", () => {
    const resolved = resolveNarrationDurationSeconds({
      audio: Buffer.alloc(0),
      text: "hello world",
      estimateSpeechDurationSeconds: () => 3.5,
    });
    expect(resolved).toBe(3.5);
  });
});
