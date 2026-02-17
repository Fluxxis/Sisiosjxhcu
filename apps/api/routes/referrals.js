import { requireUser } from "./me.js";
import { nanoToTon } from "../lib/ton.js";
import { getReferralNano } from "../db.js";

export function referralRoutes(fastify) {
  fastify.get("/referrals/stats", async (req, reply) => {
    try{
      const u = await requireUser(fastify, req);
      const invited = await fastify.db.all("SELECT tg_id FROM users WHERE referrer_tg_id=?", u.tg_id);
      const invitedIds = invited.map(x=>x.tg_id);

      let active = 0;
      let friendsStake = 0n;
      let earned = 0n;

      for (const id of invitedIds) {
        const bets = await fastify.db.get("SELECT COUNT(*) as c FROM ledger WHERE tg_id=? AND type='bet'", id);
        if ((bets?.c || 0) > 0) active++;
      }

      const refRows = await fastify.db.all("SELECT amount_nano FROM ledger WHERE tg_id=? AND type='referral_accrued'", u.tg_id);
      for (const r of refRows) earned += BigInt(r.amount_nano);

      for (const id of invitedIds) {
        const rows = await fastify.db.all("SELECT amount_nano FROM ledger WHERE tg_id=? AND type='bet'", id);
        for (const rr of rows) friendsStake += (-BigInt(rr.amount_nano));
      }

      const available = await getReferralNano(fastify.db, u.tg_id);

      return {
        ok:true,
        invited: invitedIds.length,
        active,
        friends_stake_ton: nanoToTon(friendsStake),
        earned_ton: nanoToTon(earned),
        available_ton: nanoToTon(available)
      };
    }catch{
      return reply.code(401).send({ ok:false });
    }
  });
}
