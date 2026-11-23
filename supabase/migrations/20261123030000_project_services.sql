begin;

-- The provider is stored directly only for services that do not use an account.
-- Existing rows retain their account, purpose and notes.
alter table public.project_service_accounts
  alter column service_account_id drop not null,
  add column provider_id uuid references public.service_providers (id) on delete restrict,
  add column service_kind text check (service_kind in (
    'hosting', 'registrar', 'dns', 'mailbox', 'contact_form', 'transactional_email',
    'analytics', 'search_console', 'source_control', 'deployment', 'database', 'cms', 'other'
  )),
  add column destination_email text check (
    length(destination_email) <= 254 and destination_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  add column routing_notes text check (length(routing_notes) <= 2000),
  add constraint project_service_source_check check (num_nonnulls(service_account_id, provider_id) = 1),
  add constraint project_service_email_scope_check check (
    (destination_email is null and routing_notes is null)
    or coalesce(service_kind in ('mailbox', 'contact_form', 'transactional_email'), false)
  );

create unique index project_services_provider_purpose_key
  on public.project_service_accounts (project_id, provider_id, lower(btrim(purpose)))
  where service_account_id is null;
create index project_services_provider_idx on public.project_service_accounts (provider_id)
  where provider_id is not null;

-- Existing grants, account duplicate/archive checks, and AAL2 RLS remain in force.
commit;
