begin;

create function hub_private.is_service_url(value text)
returns boolean language sql immutable strict set search_path = ''
as $$
  select length(value) <= 2048
    and strpos(value, chr(92)) = 0
    and value ~* '^https?://[^/@[:space:]?#]+(/[^[:space:]?#]*)?$';
$$;
revoke all on function hub_private.is_service_url(text) from public;
grant execute on function hub_private.is_service_url(text) to authenticated;

alter table public.service_providers
  add constraint service_providers_category_check check (category in (
    'Hosting', 'Deployment', 'Domain Registrar', 'DNS / CDN', 'Email', 'Transactional Email',
    'Source Control', 'Database', 'CMS', 'Analytics', 'Marketing', 'Other'
  )) not valid,
  add constraint service_providers_website_url_check check (hub_private.is_service_url(website_url)) not valid,
  add constraint service_providers_dashboard_url_check check (hub_private.is_service_url(dashboard_url)) not valid;

alter table public.service_accounts
  add column archived_at timestamptz,
  add column search_text text generated always as (
    label || ' ' || coalesce(email, '') || ' ' || coalesce(username, '')
  ) stored,
  add constraint service_accounts_label_check check (length(btrim(label)) between 1 and 160) not valid,
  add constraint service_accounts_ownership_check check (ownership_type in ('mine', 'client', 'shared')) not valid,
  add constraint service_accounts_login_url_check check (hub_private.is_service_url(login_url)) not valid;

alter table public.project_service_accounts
  add constraint project_service_accounts_purpose_check check (length(btrim(purpose)) between 1 and 160) not valid;

-- Retain the existing FK restrictions, timestamp triggers, and single-admin AAL2 policies.
grant select, insert, update, delete on public.service_providers, public.service_accounts to authenticated;
grant select, insert, delete on public.project_service_accounts to authenticated;

create index service_accounts_updated_idx on public.service_accounts (updated_at desc, id);

create function hub_private.check_project_account_link()
returns trigger language plpgsql set search_path = ''
as $$
declare
  account_archived_at timestamptz;
begin
  -- Serialize link inserts for this account and coordinate them with archiving.
  select archived_at into account_archived_at
    from public.service_accounts where id = new.service_account_id
    for no key update;
  if account_archived_at is not null then
    raise exception 'Archived accounts cannot be linked' using errcode = '23514';
  end if;
  if exists (
    select from public.project_service_accounts
    where project_id = new.project_id and service_account_id = new.service_account_id
      and id is distinct from new.id
      and lower(btrim(purpose)) = lower(btrim(new.purpose))
  ) then
    raise exception 'This purpose is already linked' using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger check_project_account_link before insert or update of project_id, service_account_id, purpose
  on public.project_service_accounts for each row execute function hub_private.check_project_account_link();

commit;
