begin;

alter table public.domains
  add column renewal_responsibility text check (renewal_responsibility in ('nmark', 'client', 'other')),
  add constraint domains_valid_name check (
    lower(rtrim(btrim(name), '.')) ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]([a-z0-9-]{0,61}[a-z0-9])?$'
  ) not valid,
  add constraint domains_status_check check (status in ('active', 'pending', 'expired', 'inactive', 'archived')) not valid,
  add constraint domains_dates_check check (expires_on >= registered_on) not valid,
  add constraint domains_finite_values_check check (
    renewal_price <> 'NaN'::numeric and isfinite(registered_on) and isfinite(expires_on)
  ) not valid;

alter table public.hosting_services
  add column renewal_responsibility text check (renewal_responsibility in ('nmark', 'client', 'other')),
  add column search_text text generated always as (hosting_type || ' ' || coalesce(plan_name, '')) stored,
  add constraint hosting_status_check check (status in ('active', 'pending', 'suspended', 'inactive', 'archived')) not valid,
  add constraint hosting_type_check check (hosting_type in (
    'Shared Hosting', 'VPS', 'Cloud Hosting', 'Managed WordPress', 'Serverless', 'Static Hosting', 'Dedicated Server', 'Other'
  )) not valid,
  add constraint hosting_billing_cycle_check check (billing_cycle in ('Monthly', 'Quarterly', 'Semiannual', 'Annual', 'Custom')) not valid,
  add constraint hosting_finite_values_check check (renewal_price <> 'NaN'::numeric and isfinite(renews_on)) not valid;

-- Preserve historical names while requiring a unique non-archived record for each domain.
create unique index domains_current_name_key on public.domains (lower(rtrim(btrim(name), '.'))) where status <> 'archived';
drop index public.domains_name_key;
create index domains_updated_idx on public.domains (updated_at desc, id);
create index hosting_services_updated_idx on public.hosting_services (updated_at desc, id);

create table public.renewal_history (
  id uuid primary key,
  domain_id uuid references public.domains (id) on delete restrict,
  hosting_service_id uuid references public.hosting_services (id) on delete restrict,
  renewed_on date not null,
  period_start date,
  period_end date,
  paid_amount numeric(12, 2) check (paid_amount >= 0 and paid_amount <> 'NaN'::numeric),
  currency text check (currency ~ '^[A-Z]{3}$'),
  paid_on date,
  payment_status text not null check (payment_status in ('unpaid', 'pending', 'paid')),
  next_renewal_on date,
  notes text check (length(notes) <= 10000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(domain_id, hosting_service_id) = 1),
  check (period_end >= period_start),
  check (paid_amount is null or currency is not null),
  check (payment_status <> 'paid' or paid_amount is not null),
  check (paid_on is null or payment_status = 'paid'),
  check (next_renewal_on > renewed_on),
  check ((renewed_on is not null and isfinite(renewed_on))
    and (period_start is null or isfinite(period_start))
    and (period_end is null or isfinite(period_end))
    and (paid_on is null or isfinite(paid_on))
    and (next_renewal_on is null or isfinite(next_renewal_on)))
);
create index renewal_history_domain_idx on public.renewal_history (domain_id, renewed_on desc, id);
create index renewal_history_hosting_idx on public.renewal_history (hosting_service_id, renewed_on desc, id);

alter table public.renewal_history enable row level security;
revoke all on public.renewal_history from public, anon, authenticated;
create policy hub_admin_mfa on public.renewal_history to authenticated
  using ((select public.is_hub_admin()) and (select auth.jwt()->>'aal') = 'aal2')
  with check ((select public.is_hub_admin()) and (select auth.jwt()->>'aal') = 'aal2');

grant select, insert, update, delete on public.domains, public.hosting_services to authenticated;
grant select on public.renewal_history to authenticated;

-- Execute as the table owner so history can only be appended through this function.
-- Check the administrator and MFA claims before locking or reading any business rows.
create function public.record_asset_renewal(
  p_event_id uuid, p_kind text, p_record_id uuid, p_renewed_on date, p_period_start date, p_period_end date,
  p_paid_amount numeric, p_currency text, p_paid_on date, p_payment_status text, p_next_renewal_on date, p_notes text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  parent_id uuid;
  history_id uuid;
begin
  if not public.is_hub_admin() or (auth.jwt()->>'aal') is distinct from 'aal2' then
    raise exception 'Administrator MFA is required' using errcode = '42501';
  end if;

  if p_paid_amount <> round(p_paid_amount, 2) then
    raise exception 'Payment amount requires at most two decimal places' using errcode = '23514';
  end if;

  if p_kind = 'domains' then
    select id into parent_id from public.domains where id = p_record_id for update;
  elsif p_kind = 'hosting' then
    select id into parent_id from public.hosting_services where id = p_record_id for update;
  else
    raise exception 'Invalid renewal target' using errcode = '22023';
  end if;
  if parent_id is null then
    raise exception 'Renewal target does not exist' using errcode = '23503';
  end if;

  insert into public.renewal_history (
    id, domain_id, hosting_service_id, renewed_on, period_start, period_end,
    paid_amount, currency, paid_on, payment_status, next_renewal_on, notes
  ) values (
    p_event_id, case when p_kind = 'domains' then parent_id end, case when p_kind = 'hosting' then parent_id end,
    p_renewed_on, p_period_start, p_period_end, p_paid_amount, p_currency, p_paid_on, p_payment_status, p_next_renewal_on, p_notes
  ) on conflict (id) do nothing returning id into history_id;

  if history_id is null then
    if not exists (
      select from public.renewal_history where id = p_event_id
        and (p_kind = 'domains' and domain_id = parent_id or p_kind = 'hosting' and hosting_service_id = parent_id)
        and row(renewed_on, period_start, period_end, paid_amount, currency, paid_on, payment_status, next_renewal_on, notes)
          is not distinct from row(p_renewed_on, p_period_start, p_period_end, p_paid_amount, p_currency, p_paid_on,
            p_payment_status, p_next_renewal_on, p_notes)
    ) then
      raise exception 'Renewal request already used' using errcode = '23505';
    end if;
    return p_event_id;
  end if;

  if p_next_renewal_on is not null then
    if p_kind = 'domains' then
      update public.domains set expires_on = p_next_renewal_on where id = parent_id;
    else
      update public.hosting_services set renews_on = p_next_renewal_on where id = parent_id;
    end if;
  end if;
  return history_id;
end;
$$;
revoke all on function public.record_asset_renewal(uuid, text, uuid, date, date, date, numeric, text, date, text, date, text)
  from public, anon, authenticated;
grant execute on function public.record_asset_renewal(uuid, text, uuid, date, date, date, numeric, text, date, text, date, text)
  to authenticated;

commit;
