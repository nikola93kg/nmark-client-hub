# NMark Client Hub

Private client and project management for NMark Designs. The application is designed to run at `https://clients.nmarkdesigns.com` with its own Supabase Auth project, database and host-only session cookie. The site navigation portal can link to the root URL or a client/project deep link.

## Run locally

Use Node.js 22 or newer.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000. For a local preview without Supabase, start with `CLIENT_HUB_DEMO=true npm run dev` and choose **Open demo**. The loopback demo adds fictional clients, projects and service accounts and saves edits to the ignored `.client-hub-demo/data.json` file. Use fictional records here. Next.js production builds ignore the demo flag.

## Connect a development Supabase project

1. Apply the migrations in order from [supabase/migrations](supabase/migrations) to a dedicated development Supabase project. For local Supabase CLI, use `supabase start` from this directory. The checked-in local configuration disables signup and enables TOTP.
2. For a hosted development project, disable new-user signup and anonymous sign-in, enable TOTP enrollment and verification, and set the Auth Site URL to the application's URL. Use the values from `.env.example` for production targets when provisioning is separately approved. [Supabase Auth settings](https://supabase.com/docs/guides/auth/general-configuration)
3. Create and confirm the single administrator in Supabase Auth. Add its Auth user UUID to the allowlist from the Supabase SQL editor or an administrative database session.

   ```sql
   insert into hub_private.administrator (user_id)
   values ('<administrator auth.users UUID>');
   ```

4. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`, leave demo mode off, and restart Next.js. Sign in as the administrator and complete authenticator enrollment on the first sign-in. Credential entry and TOTP verification go through Supabase Auth. The application and database both require an MFA-verified session before granting access to business records.

Archive records to retain their history. To permanently delete a client, first move or delete its projects. Keep credentials and recovery material in Pass Vault. Client Hub fields are for business information and links.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The tests cover field and redirect validation plus the migration's RLS, audit timestamps and foreign-key behavior in embedded PostgreSQL with simulated Supabase claims. Live Supabase Auth, TOTP and PostgREST can be checked with the development project configured above.

## Service accounts and Pass Vault

Open **Service Accounts → Manage providers** to add providers, then create accounts and select each account’s provider. Open a project and use **Services & Accounts** to link an existing account with a purpose. One account can serve multiple projects and purposes. Archiving an account keeps existing connections and removes it from the picker until it is restored. Unlinking removes only the selected connection.

In the account editor, paste the **Stable Vault Item ID** and set `NEXT_PUBLIC_PASS_VAULT_URL` to the Vault origin in your environment. **Open in Pass Vault** opens the entry in a new tab, where Pass Vault handles its own sign-in, MFA and unlock. Keep login and dashboard URLs free of query parameters and fragments. [Pass Vault integration contract](https://github.com/nikola93kg/pass-manager/blob/main/CLIENT_HUB_INTEGRATION.md)

The Phase 2 migration adds account archiving, search and input constraints, enables access to provider, account and association tables under the existing MFA policies, and retains the Phase 1 data and relationships. Apply it to your development database before running the Phase 2 application against Supabase.

## Phase 3

Build the domains and hosting screens, connect records to existing service accounts, and add renewal tracking.
