export function tonToNano(tonStr) {
  const s = String(tonStr).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("Invalid TON amount");
  const [a, b=""] = s.split(".");
  const frac = (b + "000000000").slice(0, 9);
  return BigInt(a) * 1000000000n + BigInt(frac);
}
export function nanoToTon(n) {
  const x = BigInt(n);
  const sign = x < 0n ? "-" : "";
  const abs = x < 0n ? -x : x;
  const a = abs / 1000000000n;
  const b = abs % 1000000000n;
  const frac = b.toString().padStart(9, "0").replace(/0+$/, "");
  return sign + a.toString() + (frac ? "." + frac : "");
}
