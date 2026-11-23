begin;

create schema if not exists hub_private;
revoke all on schema hub_private from public, anon, authenticated;

create table hub_private.administrator (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users (id) on delete restrict
);

create function public.is_hub_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select from hub_private.administrator where user_id = (select auth.uid())
  ) and (select auth.jwt()->>'is_anonymous') is distinct from 'true';
$$;
revoke all on function public.is_hub_admin() from public, anon, authenticated;
grant execute on function public.is_hub_admin() to authenticated;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  company text check (length(company) <= 160),
  contact_person text check (length(contact_person) <= 160),
  email text check (length(email) <= 254),
  phone text check (length(phone) <= 80),
  website text check (length(website) <= 2048 and website ~* '^https?://'),
  country text check (length(country) <= 120),
  city text check (length(city) <= 120),
  address text check (length(address) <= 300),
  status text not null default 'prospect' check (status in ('active', 'inactive', 'archived', 'prospect')),
  notes text check (length(notes) <= 10000),
  search_text text generated always as (
    name || ' ' || coalesce(company, '') || ' ' || coalesce(contact_person, '') || ' ' || coalesce(email, '')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 160),
  website text check (length(website) <= 2048 and website ~* '^https?://'),
  project_type text check (length(project_type) <= 120),
  description text check (length(description) <= 10000),
  status text not null default 'development' check (status in ('active', 'development', 'maintenance', 'suspended', 'archived')),
  technology_stack text check (length(technology_stack) <= 300),
  repository_url text check (length(repository_url) <= 2048 and repository_url ~* '^https?://'),
  cms_url text check (length(cms_url) <= 2048 and cms_url ~* '^https?://'),
  production_url text check (length(production_url) <= 2048 and production_url ~* '^https?://'),
  staging_url text check (length(staging_url) <= 2048 and staging_url ~* '^https?://'),
  technical_notes text check (length(technical_notes) <= 10000),
  search_text text generated always as (
    name || ' ' || coalesce(website, '') || ' ' || coalesce(project_type, '') || ' ' || coalesce(technology_stack, '')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  category text not null,
  website_url text,
  dashboard_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index service_providers_name_key on public.service_providers (lower(btrim(name)));

create table public.service_accounts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.service_providers (id) on delete restrict,
  label text not null,
  email text,
  username text,
  login_url text,
  vault_item_id uuid,
  ownership_type text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_service_accounts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  service_account_id uuid not null references public.service_accounts (id) on delete restrict,
  purpose text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, service_account_id, purpose)
);

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  registrar_account_id uuid references public.service_accounts (id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 253),
  registered_on date,
  expires_on date,
  renewal_price numeric(12, 2) check (renewal_price >= 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  auto_renew boolean not null default false,
  status text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (renewal_price is null or currency is not null)
);
create unique index domains_name_key on public.domains (lower(rtrim(btrim(name), '.')));

create table public.hosting_services (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  hosting_account_id uuid not null references public.service_accounts (id) on delete restrict,
  hosting_type text not null,
  plan_name text,
  server_notes text,
  renews_on date,
  renewal_price numeric(12, 2) check (renewal_price >= 0),
  currency text check (currency ~ '^[A-Z]{3}$'),
  billing_cycle text,
  auto_renew boolean not null default false,
  status text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (renewal_price is null or currency is not null)
);

create index clients_updated_idx on public.clients (updated_at desc, id);
create index clients_status_idx on public.clients (status, updated_at desc, id);
create index projects_updated_idx on public.projects (updated_at desc, id);
create index projects_status_idx on public.projects (status, updated_at desc, id);
create index projects_client_idx on public.projects (client_id, updated_at desc, id);
create index service_accounts_provider_idx on public.service_accounts (provider_id);
create index project_service_accounts_account_idx on public.project_service_accounts (service_account_id);
create index domains_project_idx on public.domains (project_id);
create index domains_registrar_idx on public.domains (registrar_account_id);
create index domains_expiry_idx on public.domains (expires_on);
create index hosting_project_idx on public.hosting_services (project_id);
create index hosting_account_idx on public.hosting_services (hosting_account_id);
create index hosting_renewal_idx on public.hosting_services (renews_on);

create function hub_private.set_audit_timestamps()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.created_at = old.created_at;
    new.id = old.id;
  else
    new.created_at = now();
  end if;
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clients', 'projects', 'service_providers', 'service_accounts',
    'project_service_accounts', 'domains', 'hosting_services'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format(
      'create policy hub_admin_mfa on public.%I to authenticated
       using ((select public.is_hub_admin()) and (select auth.jwt()->>''aal'') = ''aal2'')
       with check ((select public.is_hub_admin()) and (select auth.jwt()->>''aal'') = ''aal2'')',
      table_name
    );
    execute format(
      'create trigger audit_timestamps before insert or update on public.%I
       for each row execute function hub_private.set_audit_timestamps()',
      table_name
    );
  end loop;
end;
$$;

-- Later modules have policies in place. Expose only the tables used in Phase 1.
grant select, insert, update, delete on public.clients, public.projects to authenticated;

commit;
