# CraftFlow Referrals

Partner / referral program for CraftFlow — Django REST Framework + PostgreSQL backend, Next.js frontend,
in the CraftFlow theme. Production: **https://referral.flexiflow.tech**

## What it does

**Admins**
- Create partners (and other admins) with a unique referral code (auto-generated or custom), login and payout details.
- Define **commission groups** — percentage of project value or a fixed amount per won project, with an optional
  bonus tier after N won projects — and assign partners to them. A partner can also get a custom % that overrides the group.
- Track every referred **project**: move it through New → Contacted → Proposal sent → Won / Lost, set the final contract value.
  Winning a project creates a pending commission; changing the value recalculates it; losing it cancels it.
- Approve commissions (one by one, all at once, or automatically after N days), add manual bonuses/adjustments.
- Handle **payout** requests: mark processing / paid (with a transaction reference) or reject.
- Program settings: name, currency, minimum payout, auto-approve days, partner terms. CSV export on every list.

**Partners**
- Dashboard with their code and shareable link (`/r/<CODE>`), link visits, code uses, conversion, earnings by month,
  commission rate and bonus progress, available balance.
- Refer projects themselves, or let clients submit through the public referral link (code applied automatically).
- See commissions and request payouts of their approved balance (above the minimum).

## Local development

```bash
# backend (Postgres on localhost:5432, db/user "referral" — see backend/.env.example)
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/python manage.py migrate && .venv/bin/python manage.py seed_demo   # admin / admin12345, partners sara|leo|mia|omar / partner12345
.venv/bin/python manage.py runserver 8000

# frontend
cd frontend && npm ci && npm run dev    # http://localhost:3000 (proxies /api to :8000)
```

Tests: `cd backend && .venv/bin/python manage.py test referrals`

Deployment: see [DEPLOY.md](DEPLOY.md).
