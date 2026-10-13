-- DESTRUCTIVE: permanently deletes every product, transaction, and finance entry.
-- Run only when intentionally starting this store with empty cloud data.
truncate table public.finance_entries, public.transactions, public.products restart identity;
