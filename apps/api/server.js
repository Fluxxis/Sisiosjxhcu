import Fastify from "fastify";
import cors from "@fastify/cors";
import env from "@fastify/env";
import { openDb } from "./db.js";
import { applyJsonConfigToEnv } from "./config/applyJsonConfig.js";

import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { jackpotRoutes } from "./routes/jackpot.js";
import { txRoutes } from "./routes/transactions.js";
import { paymentRoutes } from "./routes/payments.js";
import { bonusRoutes } from "./routes/bonuses.js";
import { referralRoutes } from "./routes/referrals.js";
import { promoRoutes } from "./routes/promo.js";
import { settingsRoutes } from "./routes/settings.js";
import { botRoutes } from "./routes/bot.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { startPaymentsWorker } from "./worker/paymentsWorker.js";

// Load configuration from JSON files (no .env required)
applyJsonConfigToEnv();

const schema = {
  type: "object",
  required: ["BOT_TOKEN"],
  properties: {
    BOT_TOKEN: { type: "string" },
    ADMIN_TG_IDS: { type: "string", default: "" },
    PORT: { type: "string", default: "8787" },
    CORS_ORIGIN: { type: "string", default: "http://localhost:3000" },

    ALLOW_DEMO_AUTH: { type: "string", default: "1" },
    SKIP_SUB_CHECK: { type: "string", default: "1" },

    DEMO_MODE: { type: "string", default: "1" },
    DEMO_MAIN_PRIZE_IDS: { type: "string", default: "1,2,3,4" },
    DEMO_MAIN_PROB: { type: "string", default: "0.9" },

    ROUND_TARGET_TON: { type: "string", default: "0.10" },
    RAKEBACK_PCT: { type: "string", default: "0.005" },
    REFERRAL_PCT: { type: "string", default: "0.0025" },
    MIN_WITHDRAW_TON: { type: "string", default: "1" },
    TREASURY_ADDRESS: { type: "string", default: "" },

    // Payments / blockchain
    TON_NETWORK: { type: "string", default: "mainnet" },
    TONCENTER_BASE_URL: { type: "string", default: "https://toncenter.com/api/v2" },
    TONCENTER_API_KEY: { type: "string", default: "" },
    TON_RPC_URL: { type: "string", default: "https://toncenter.com/api/v2/jsonRPC" },
    TREASURY_MNEMONIC: { type: "string", default: "" },

    CRYPTOBOT_API_TOKEN: { type: "string", default: "" },
    CRYPTOBOT_BASE_URL: { type: "string", default: "https://pay.crypt.bot" },

    DEPOSIT_POLL_MS: { type: "string", default: "6000" },
    WITHDRAW_POLL_MS: { type: "string", default: "4000" }
  }
};

const fastify = Fastify({ logger:false });
await fastify.register(env, { schema, dotenv:false });
const corsOrigin = (fastify.config.CORS_ORIGIN === "*") ? true : fastify.config.CORS_ORIGIN;
await fastify.register(cors, { origin: corsOrigin, credentials:true });

fastify.db = await openDb();

fastify.get("/health", async () => ({ ok:true }));

authRoutes(fastify);
meRoutes(fastify);
jackpotRoutes(fastify);
txRoutes(fastify);
paymentRoutes(fastify);
bonusRoutes(fastify);
referralRoutes(fastify);
promoRoutes(fastify);
settingsRoutes(fastify);
botRoutes(fastify);
leaderboardRoutes(fastify);

// Background worker: auto-confirm deposits + auto-withdraw
startPaymentsWorker(fastify);

const port = Number(fastify.config.PORT || 8787);
await fastify.listen({ port, host:"0.0.0.0" });
console.log("API listening on", port);
