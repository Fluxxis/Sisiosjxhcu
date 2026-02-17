# Raise TON Suite (Bot + API + WebApp)

Template that reproduces the modules/UI from your screenshots:
- Jackpot reel with 15 placeholder items (no NFT assets)
- Deposits/Withdrawals (invoice + admin confirmation)
- Transactions
- Bonuses (daily + cashback claim + promo)
- Referrals (0.25% from friend's bet)
- Channel gate configurable by admin via bot

## Odds you requested
### DEMO mode
- **90%**: NFT in **[1,2,3,4]**
- **10%**: NFT in **[5..15]**

### PROD mode
- All NFTs baseline equal, but **NFT 1..5 have 2x lower chance** than NFT 6..15.
  - Each NFT 1..5 = 4%
  - Each NFT 6..15 = 8%

## Quick start
```bash
npm install

cp apps/api/.env.example apps/api/.env
cp apps/bot/.env.example apps/bot/.env
cp apps/web/.env.example apps/web/.env.local

# Put your BOT_TOKEN everywhere (api+bot)
npm run dev
```

### Admin bot commands
- `/channels` — show required channels
- `/setchannels none` — disable gate
- `/setchannels @a,@b` — set required channels list
- `/confirm_deposit <id>` — confirm deposit
- `/pay_withdrawal <id> [tx_hash]` — mark withdrawal paid


## One-command start with Cloudflare Tunnel

```bash
chmod +x start_all.sh
./start_all.sh
```

It will:
- start 2 quick tunnels (WEB+API)
- run API/Web/Bot
- print public URLs

Edit `apps/api/.env` and `apps/bot/.env` first (BOT_TOKEN, ADMIN_TG_IDS).
