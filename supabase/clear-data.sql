-- DESTRUCTIVE: permanently deletes every product, stock adjustment, transaction, manual customer credit, and finance entry.
-- Run only when intentionally starting this store with empty cloud data.
truncate table public.finance_entries, public.manual_customer_credits, public.transactions, public.product_stock_adjustments, public.products restart identity;
