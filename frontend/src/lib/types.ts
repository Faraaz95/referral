export type Role = 'admin' | 'partner';
export interface GroupMini { id: number; name: string; type: 'percent' | 'fixed'; rate: string; fixed_amount: string; bonus_threshold: number; bonus_rate: string; color: string }
export interface Group extends GroupMini { description: string; is_default: boolean; members: number; created_at: string }
export interface Me {
  id: number; username: string; email: string; first_name: string; last_name: string; name: string; initials: string; is_admin: boolean;
  profile: { role: Role; code: string | null; group: GroupMini | null; custom_rate: string | null; company: string; phone: string; website: string; payout_method: string; payout_details: string; clicks: number };
}
export interface Opt { value: string; label: string }
export interface ProgramSettings { name: string; currency: string; min_payout: string; auto_approve_days: number; terms: string; public_signup: boolean }
export interface Options {
  settings: ProgramSettings; referral_statuses: Opt[]; commission_statuses: Opt[]; payout_statuses: Opt[]; payout_methods: Opt[];
  groups?: Group[]; partners?: { id: number; name: string; code: string | null }[];
}
export interface UserMini { id: number; name: string; initials: string; email: string; code: string | null }
export interface Stats { referrals: number; won: number; earned: number | string; pending: number | string; approved: number | string; paid: number | string }
export interface Partner {
  id: number; username: string; email: string; first_name: string; last_name: string; name: string; initials: string; is_active: boolean;
  date_joined: string; last_login: string | null; role: Role; code: string | null; group_id: number | null; group: GroupMini | null;
  custom_rate: string | null; company: string; phone: string; website: string; payout_method: string; payout_details: string; notes: string;
  clicks: number; stats: Stats;
}
export interface Referral {
  id: number; partner: UserMini; code: string; source: 'partner' | 'link' | 'admin'; client_name: string; client_email: string; client_phone: string;
  company: string; project: string; description: string; estimated_value: string | null; value: string | null;
  status: 'new' | 'contacted' | 'proposal' | 'won' | 'lost'; admin_note?: string; created_at: string; updated_at: string; won_at: string | null;
  commission: { id: number; amount: string; status: string; rate: string } | null;
}
export interface Commission {
  id: number; partner: UserMini; referral: number | null; referral_name: string; description: string; base_value: string; rate: string;
  amount: string; status: 'pending' | 'approved' | 'paid' | 'cancelled'; payout: number | null; payout_ref: string; created_at: string; approved_at: string | null;
}
export interface Payout {
  id: number; partner: UserMini; amount: string; method: string; details: string; reference: string; status: 'requested' | 'processing' | 'paid' | 'rejected';
  note: string; requested_at: string; paid_at: string | null; n_commissions: number;
}
export interface MonthPoint { month: string; label: string; total: number }
