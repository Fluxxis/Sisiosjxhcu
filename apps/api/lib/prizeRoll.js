import crypto from "crypto";

// Deterministic roll for the winning item index.
// It produces a deterministic winning item index (1..15 by default) from a seed.

export function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function randFloat(seed, salt) {
  const h = sha256Hex(`${seed}|${salt}`);
  return parseInt(h.slice(0, 12), 16) / 0x1000000000000;
}

/**
 * Roll an item index.
 * - prod: uniform in [1..maxIndex]
 * - demo: optionally heavily biased towards demoMainIds
 */
export function rollPrizeIndex({ mode, seed, demoMainIds, demoMainProb, maxIndex = 15 }) {
  const ids = Array.isArray(demoMainIds) ? demoMainIds : [];
  const p = Number.isFinite(demoMainProb) ? demoMainProb : 0;

  if (mode === "demo" && ids.length > 0 && p > 0) {
    const rBias = randFloat(seed, "prize:bias");
    if (rBias < p) {
      const rPick = randFloat(seed, "prize:pick");
      const idx = Math.min(ids.length - 1, Math.floor(rPick * ids.length));
      const v = Number(ids[idx]);
      if (Number.isFinite(v) && v >= 1 && v <= maxIndex) return v;
    }
  }

  const r = randFloat(seed, "prize:roll");
  return 1 + Math.floor(r * maxIndex);
}
