-- Cash module schema (Supabase/PostgreSQL)
-- Run this file in Supabase SQL editor before using the module.

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  cashbox_id text not null default 'main',
  date timestamptz not null,
  type text not null check (type in ('income', 'expense')),
  payment_method text not null check (payment_method in ('cash', 'qr', 'transfer', 'other')),
  amount numeric(12,2) not null check (amount > 0),
  description text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cash_movements_date on public.cash_movements(date);
create index if not exists idx_cash_movements_user_cashbox_date on public.cash_movements(user_id, cashbox_id, date);

create table if not exists public.cash_closures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  cashbox_id text not null default 'main',
  start_date date not null,
  end_date date not null,
  opening_balance numeric(12,2) not null,
  expected_cash numeric(12,2) not null,
  real_cash numeric(12,2) not null,
  difference numeric(12,2) not null,
  created_at timestamptz not null default now(),
  constraint cash_closures_valid_range check (start_date <= end_date)
);

alter table public.cash_closures add column if not exists opening_qr numeric(12,2);
alter table public.cash_closures add column if not exists expected_qr numeric(12,2);
alter table public.cash_closures add column if not exists real_qr numeric(12,2);
alter table public.cash_closures add column if not exists qr_difference numeric(12,2);

create unique index if not exists uq_cash_closures_range
on public.cash_closures(user_id, cashbox_id, start_date, end_date);

create index if not exists idx_cash_closures_created_at on public.cash_closures(created_at desc);

-- Optional RLS starter policy (adjust as needed):
-- alter table public.cash_movements enable row level security;
-- alter table public.cash_closures enable row level security;
