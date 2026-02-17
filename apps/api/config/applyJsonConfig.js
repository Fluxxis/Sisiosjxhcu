import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function readJsonIfExists(p) {
  try {
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch (e) {
    console.error(`Config JSON error in ${p}:`, e?.message || e);
    return {};
  }
}

/**
 * Loads apps/api/config.json and apps/api/config.runtime.json (if exists) and merges them.
 * runtime config overrides base config.
 */
export function loadJsonConfig() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const appDir = path.resolve(__dirname, "..");
  const base = readJsonIfExists(path.join(appDir, "config.json"));
  const runtime = readJsonIfExists(path.join(appDir, "config.runtime.json"));
  return Object.assign({}, base, runtime);
}

/**
 * Applies JSON config to process.env as strings (so @fastify/env keeps working).
 * Does NOT require a .env file.
 */
export function applyJsonConfigToEnv() {
  const cfg = loadJsonConfig();
  for (const [k, v] of Object.entries(cfg)) {
    if (v === undefined || v === null) continue;
    // Keep existing env if already set (but JSON still usually fills everything)
    if (process.env[k] === undefined) process.env[k] = String(v);
  }
  return cfg;
}
