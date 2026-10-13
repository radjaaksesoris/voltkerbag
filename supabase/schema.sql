-- ============================================
-- VOLTKER — Skema database Supabase
-- Jalankan di: Supabase Dashboard → SQL Editor → New query
-- ============================================

create table if not exists products (
  id bigint primary key,
  owner_id uuid not null default auth.uid(),
  name text not null,
  category text,
  price double precision default 0,
  cost double precision default 0,
  stock integer default 0,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

create table if not exists transactions (
  id bigint primary key,
  owner_id uuid not null default auth.uid(),
  items jsonb not null default '[]'::jsonb,
  total double precision default 0,
  payment double precision default 0,
  "change" double precision default 0,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

create table if not exists finance_entries (
  id bigint primary key,
  owner_id uuid not null default auth.uid(),
  type text not null,               -- income | expense | capital
  category text,
  note text,
  amount double precision default 0,
  "refId" bigint,
  date timestamptz,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

-- Add ownership to tables that were created with the older schema.
alter table products add column if not exists owner_id uuid default auth.uid();
alter table transactions add column if not exists owner_id uuid default auth.uid();
alter table finance_entries add column if not exists owner_id uuid default auth.uid();

create index if not exists products_owner_id_idx on products (owner_id);
create index if not exists transactions_owner_id_idx on transactions (owner_id);
create index if not exists finance_entries_owner_id_idx on finance_entries (owner_id);

alter table products enable row level security;
alter table transactions enable row level security;
alter table finance_entries enable row level security;

drop policy if exists "Users can access their own products" on products;
create policy "Users can access their own products" on products
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can access their own transactions" on transactions;
create policy "Users can access their own transactions" on transactions
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can access their own finance entries" on finance_entries;
create policy "Users can access their own finance entries" on finance_entries
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
