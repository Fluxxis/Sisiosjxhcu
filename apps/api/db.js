import { open } from "sqlite";
import sqlite3 from "sqlite3";
import { nanoToTon } from "./lib/ton.js";

export async function openDb() {
  const db = await open({ filename:"./data.sqlite", driver: sqlite3.Database });
  await db.exec(`PRAGMA journal_mode=WAL;

  CREATE TABLE IF NOT EXISTS users (
    tg_id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    registered_at TEXT NOT NULL,
    wallet_address TEXT,
    referrer_tg_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount_nano TEXT NOT NULL,
    created_at TEXT NOT NULL,
    meta_json TEXT
  );

  CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id INTEGER NOT NULL,
    amount_nano TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    confirmed_at TEXT,
    comment TEXT,
    method TEXT DEFAULT 'manual',
    source_address TEXT,
    tx_hash TEXT,
    invoice_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tg_id INTEGER NOT NULL,
    amount_nano TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    paid_at TEXT,
    tx_hash TEXT,
    to_address TEXT,
    error TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL,
    target_bank_nano TEXT NOT NULL,
    bank_nano TEXT NOT NULL,
    server_commit TEXT NOT NULL,
    server_seed TEXT NOT NULL,
    winner_tg_id INTEGER,
    winning_nft_index INTEGER,
    created_at TEXT NOT NULL,
    closed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER NOT NULL,
    tg_id INTEGER NOT NULL,
    amount_nano TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS round_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER NOT NULL,
    bank_nano TEXT NOT NULL,
    winner_tg_id INTEGER NOT NULL,
    winning_nft_index INTEGER NOT NULL,
    server_commit TEXT NOT NULL,
    server_seed_reveal TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cashback (
    tg_id INTEGER PRIMARY KEY,
    available_nano TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS referral_earnings (
    tg_id INTEGER PRIMARY KEY,
    available_nano TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS promo_codes (
    code TEXT PRIMARY KEY,
    amount_nano TEXT NOT NULL,
    max_uses INTEGER NOT NULL,
    uses INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS promo_activations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    tg_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(code, tg_id)
  );
  `);

  // Lightweight migrations for existing DBs
  async function ensureColumn(table, col, ddl) {
    const cols = await db.all(`PRAGMA table_info(${table})`);
    if (!cols.some(c => c.name === col)) {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  }
  await ensureColumn('deposits', 'method', "method TEXT DEFAULT 'manual'");
  await ensureColumn('deposits', 'source_address', 'source_address TEXT');
  await ensureColumn('deposits', 'tx_hash', 'tx_hash TEXT');
  await ensureColumn('deposits', 'invoice_id', 'invoice_id INTEGER');
  await ensureColumn('withdrawals', 'to_address', 'to_address TEXT');
  await ensureColumn('withdrawals', 'error', 'error TEXT');

  const s = await db.get("SELECT value_json FROM settings WHERE key='required_channels'");
  if (!s) await db.run("INSERT INTO settings(key,value_json) VALUES('required_channels', ?)", JSON.stringify([]));
  return db;
}

export async function ledgerAdd(db, tgId, type, amountNano, meta=null) {
  await db.run(
    "INSERT INTO ledger(tg_id,type,amount_nano,created_at,meta_json) VALUES(?,?,?,?,?)",
    tgId, type, String(amountNano), new Date().toISOString(), meta ? JSON.stringify(meta) : null
  );
}

export async function getBalanceNano(db, tgId) {
  // Spendable balance only (pending + accrued bonuses are excluded)
  const rows = await db.all(
    "SELECT amount_nano FROM ledger WHERE tg_id=? AND type IN ('deposit_confirmed','win','bet','withdraw_requested','withdraw_failed_refund')",
    tgId
  );
  let sum = 0n;
  for (const r of rows) sum += BigInt(r.amount_nano);
  return sum;
}

export async function getCashbackNano(db, tgId) {
  const row = await db.get("SELECT available_nano FROM cashback WHERE tg_id=?", tgId);
  return row ? BigInt(row.available_nano) : 0n;
}
export async function addCashbackNano(db, tgId, deltaNano) {
  const cur = await getCashbackNano(db, tgId);
  const next = cur + BigInt(deltaNano);
  await db.run(
    "INSERT INTO cashback(tg_id,available_nano) VALUES(?,?) ON CONFLICT(tg_id) DO UPDATE SET available_nano=excluded.available_nano",
    tgId, next.toString()
  );
}
export async function getReferralNano(db, tgId) {
  const row = await db.get("SELECT available_nano FROM referral_earnings WHERE tg_id=?", tgId);
  return row ? BigInt(row.available_nano) : 0n;
}
export async function addReferralNano(db, tgId, deltaNano) {
  const cur = await getReferralNano(db, tgId);
  const next = cur + BigInt(deltaNano);
  await db.run(
    "INSERT INTO referral_earnings(tg_id,available_nano) VALUES(?,?) ON CONFLICT(tg_id) DO UPDATE SET available_nano=excluded.available_nano",
    tgId, next.toString()
  );
}

export function formatBalance(balanceNano, cashbackNano, referralNano) {
  return {
    ton: nanoToTon(balanceNano),
    ton_nano: balanceNano.toString(),
    cashback_available_ton: nanoToTon(cashbackNano),
    referral_available_ton: nanoToTon(referralNano),
  };
}
