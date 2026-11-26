-- DESTRUCTIVE: permanently deletes store data for ONE owner. Manual use only.
-- Required: psql -v owner_id='<owner-uuid>' -f supabase/clear-data.sql
\if :{?owner_id}
\else
\echo 'Refusing to run: set -v owner_id=<owner-uuid>'
\set ON_ERROR_STOP on
DO $$ BEGIN RAISE EXCEPTION 'owner_id psql variable is required'; END $$;
\endif

begin;
do $$
declare
  target_owner uuid := :'owner_id'::uuid;
begin
  perform set_config('voltker.internal_write', 'on', true);
  delete from public.vendor_payable_payments where owner_id = target_owner;
  delete from public.vendor_payables where owner_id = target_owner;
  delete from public.finance_entries where owner_id = target_owner;
  delete from public.transaction_payments where owner_id = target_owner;
  delete from public.manual_customer_credit_payments where owner_id = target_owner;
  delete from public.transactions where owner_id = target_owner;
  delete from public.manual_customer_credits where owner_id = target_owner;
  delete from public.product_stock_adjustments where owner_id = target_owner;
  delete from public.products where owner_id = target_owner;
  delete from public.product_categories where owner_id = target_owner;
  delete from public.product_units where owner_id = target_owner;
  delete from public.customer_names where owner_id = target_owner;
  delete from public.vendor_names where owner_id = target_owner;
  delete from public.expedition_names where owner_id = target_owner;
end $$;
commit;
