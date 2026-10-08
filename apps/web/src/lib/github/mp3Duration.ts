/**
 * Estimate MP3 duration from frame headers (CBR/VBR without relying on bitrate×size).
 * Handles optional ID3v2 preamble and Xing/Info VBR headers when present.
 */

const MPEG1_BITRATE_KBPS = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
] as const;
const MPEG2_BITRATE_KBPS = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
] as const;
const MPEG1_SAMPLE_RATES = [44100, 48000, 32000, 0] as const;
const MPEG2_SAMPLE_RATES = [22050, 24000, 16000, 0] as const;

const MIN_DURATION = 1.2;
const MAX_DURATION = 45;

function clampDuration(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return MIN_DURATION;
  return Math.max(MIN_DURATION, Math.min(MAX_DURATION, seconds));
}

function skipId3v2(buf: Buffer): number {
  if (buf.length < 10) return 0;
  if (buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return 0;
  const size =
    ((buf[6]! & 0x7f) << 21) |
    ((buf[7]! & 0x7f) << 14) |
    ((buf[8]! & 0x7f) << 7) |
    (buf[9]! & 0x7f);
  const footer = (buf[5]! & 0x10) !== 0 ? 10 : 0;
  return Math.min(buf.length, 10 + size + footer);
}

type FrameInfo = {
  length: number;
  samplesPerFrame: number;
  sampleRate: number;
  offset: number;
};

function readFrameAt(buf: Buffer, offset: number): FrameInfo | null {
  if (offset + 4 > buf.length) return null;
  if (buf[offset] !== 0xff || (buf[offset + 1]! & 0xe0) !== 0xe0) return null;

  const b1 = buf[offset + 1]!;
  const b2 = buf[offset + 2]!;
  const versionBits = (b1 >> 3) & 0x03;
  const layerBits = (b1 >> 1) & 0x03;
  if (layerBits !== 1) return null; // Layer III only

  const bitrateIndex = (b2 >> 4) & 0x0f;
  const sampleRateIndex = (b2 >> 2) & 0x03;
  const padding = (b2 >> 1) & 0x01;

  const isMpeg1 = versionBits === 3;
  const isMpeg2 = versionBits === 2;
  const isMpeg25 = versionBits === 0;
  if (!isMpeg1 && !isMpeg2 && !isMpeg25) return null;

  const bitrateTable = isMpeg1 ? MPEG1_BITRATE_KBPS : MPEG2_BITRATE_KBPS;
  const sampleRateTable = isMpeg1
    ? MPEG1_SAMPLE_RATES
    : MPEG2_SAMPLE_RATES;
  const bitrateKbps = bitrateTable[bitrateIndex] ?? 0;
  let sampleRate = sampleRateTable[sampleRateIndex] ?? 0;
  if (isMpeg25 && sampleRate > 0) sampleRate = sampleRate / 2;
  if (!bitrateKbps || !sampleRate) return null;

  const samplesPerFrame = isMpeg1 ? 1152 : 576;
  const length = Math.floor((samplesPerFrame / 8) * bitrateKbps * 1000 / sampleRate) +
    padding;
  if (length < 4) return null;

  return { length, samplesPerFrame, sampleRate, offset };
}

function readXingFrameCount(buf: Buffer, frame: FrameInfo): number | null {
  // Side info: MPEG1 mono 17, stereo 32; MPEG2 mono 9, stereo 17
  const b3 = buf[frame.offset + 3]!;
  const channelMode = (b3 >> 6) & 0x03;
  const isMono = channelMode === 3;
  const isMpeg1 = ((buf[frame.offset + 1]! >> 3) & 0x03) === 3;
  const sideInfo = isMpeg1 ? (isMono ? 17 : 32) : isMono ? 9 : 17;
  const xingOffset = frame.offset + 4 + sideInfo;
  if (xingOffset + 8 > buf.length) return null;
  const tag = buf.toString("ascii", xingOffset, xingOffset + 4);
  if (tag !== "Xing" && tag !== "Info") return null;
  const flags = buf.readUInt32BE(xingOffset + 4);
  if ((flags & 0x01) === 0) return null;
  if (xingOffset + 12 > buf.length) return null;
  return buf.readUInt32BE(xingOffset + 8);
}

/**
 * Returns clamped duration in seconds, or null if the buffer is not parseable MP3.
 */
export function measureMp3DurationSeconds(buf: Buffer): number | null {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return null;

  let offset = skipId3v2(buf);
  const first = readFrameAt(buf, offset);
  if (!first) {
    // Scan a little for sync after junk
    const scanLimit = Math.min(buf.length - 4, offset + 4096);
    let found: FrameInfo | null = null;
    for (let i = offset; i < scanLimit; i++) {
      found = readFrameAt(buf, i);
      if (found) {
        offset = i;
        break;
      }
    }
    if (!found) return null;
  }

  const start = readFrameAt(buf, offset);
  if (!start) return null;

  const xingFrames = readXingFrameCount(buf, start);
  if (xingFrames && xingFrames > 0) {
    return clampDuration((xingFrames * start.samplesPerFrame) / start.sampleRate);
  }

  let frames = 0;
  let samples = 0;
  let pos = offset;
  const maxFrames = 200_000;
  while (pos + 4 <= buf.length && frames < maxFrames) {
    const frame = readFrameAt(buf, pos);
    if (!frame) {
      pos += 1;
      continue;
    }
    if (pos + frame.length > buf.length) break;
    frames += 1;
    samples += frame.samplesPerFrame;
    pos += frame.length;
  }

  if (frames === 0) return null;
  return clampDuration(samples / start.sampleRate);
}

export function resolveNarrationDurationSeconds(input: {
  audio: Buffer | null;
  text: string;
  estimateSpeechDurationSeconds: (text: string) => number;
}): number {
  if (input.audio && input.audio.length > 0) {
    const measured = measureMp3DurationSeconds(input.audio);
    if (measured != null) return measured;
  }
  return clampDuration(input.estimateSpeechDurationSeconds(input.text));
}
