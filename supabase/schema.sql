-- ============================================
-- VOLTKER — Skema database Supabase
-- Jalankan di: Supabase Dashboard → SQL Editor → New query
-- ============================================

create table if not exists products (
  id bigint primary key,
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
  items jsonb not null default '[]'::jsonb,
  total double precision default 0,
  payment double precision default 0,
  "change" double precision default 0,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

create table if not exists finance_entries (
  id bigint primary key,
  type text not null,               -- income | expense | capital
  category text,
  note text,
  amount double precision default 0,
  "refId" bigint,
  date timestamptz,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

-- Untuk memudahkan sinkronisasi antar device, matikan Row Level Security
-- (atau buat policy sendiri jika paham keamanan database):
alter table products disable row level security;
alter table transactions disable row level security;
alter table finance_entries disable row level security;
