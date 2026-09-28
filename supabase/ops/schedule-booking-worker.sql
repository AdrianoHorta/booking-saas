-- Run after deploying booking-worker and configuring Edge Function secrets.
-- First create these entries in Supabase Vault using the dashboard:
-- booking_worker_url = https://YOUR_PROJECT.supabase.co/functions/v1/booking-worker
-- booking_worker_secret = same value as BOOKING_WORKER_SECRET (>=32 characters)
-- This script never prints secret values and replaces only this named cron job.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$
declare endpoint text; secret text;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='booking_worker_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name='booking_worker_secret';
  if endpoint is null or endpoint !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/booking-worker$' then
    raise exception 'Configure booking_worker_url in Vault'; end if;
  if secret is null or length(secret)<32 then raise exception 'Configure booking_worker_secret in Vault'; end if;
end;
$$;
select cron.schedule('booking-integrations-worker','* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='booking_worker_url'),
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='booking_worker_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
commit;
