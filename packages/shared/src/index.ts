export type UserMe = {
  tg_id: number;
  username: string;
  registered_at: string;
  wallet_address?: string | null;
  referrer_tg_id?: number | null;
};

export type Balance = {
  ton: string;
  ton_nano: string;
  cashback_available_ton: string;
  referral_available_ton: string;
};

export type Transaction = {
  id: number;
  tg_id: number;
  type: string;
  amount_ton: string;
  created_at: string;
  meta?: any;
};

export type JackpotState = {
  round_id: number;
  bank_ton: string;
  target_bank_ton: string;
  status: "open" | "resolving" | "closed";
  participants: Array<{
    tg_id: number;
    username: string;
    amount_ton: string;
    chance_pct: string;
  }>;
  history: Array<{
    round_id: number;
    bank_ton: string;
    winner_username: string;
    winner_tg_id: number;
    winning_nft_index: number;
    server_commit: string;
    server_seed_reveal?: string | null;
    created_at: string;
  }>;
};
