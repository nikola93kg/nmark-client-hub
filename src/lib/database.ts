import type { ClientInput, ProjectInput } from "./validation";

import type { ServiceKind } from "./project-services";
import type { DomainInput, HostingInput, RenewalInput } from "./infrastructure-validation";
import type { AccountInput, AssociationInput, ProviderInput } from "./service-validation";

export type Stamps = { id: string; created_at: string; updated_at: string };
export type Client = ClientInput & Stamps;
export type Project = ProjectInput & Stamps;
export type ListedProject = Project & { clients: Pick<Client, "id" | "name"> };
export type ClientOption = Pick<Client, "id" | "name" | "status">;

export type ServiceProvider = ProviderInput & Stamps;
export type ServiceAccount = AccountInput & Stamps & { archived_at: string | null };
export type ProjectServiceAssociation = Omit<AssociationInput, "service_account_id"> & {
  service_account_id: string | null;
  provider_id?: string | null;
  service_kind?: ServiceKind | null;
  destination_email?: string | null;
  routing_notes?: string | null;
};
export type ProjectAccount = ProjectServiceAssociation & Stamps & { project_id: string };
export type ListedAccount = ServiceAccount & { service_providers: Pick<ServiceProvider, "id" | "name" | "dashboard_url"> };
export type ProjectAccountView = ProjectAccount & {
  service_accounts: ListedAccount | null;
  service_providers: Pick<ServiceProvider, "id" | "name" | "dashboard_url"> | null;
};
export type AccountProjectView = ProjectAccount & { projects: Pick<Project, "id" | "name" | "status"> };

export type Domain = Omit<DomainInput, "renewal_responsibility"> & Stamps & {
  renewal_responsibility: DomainInput["renewal_responsibility"] | null;
};
export type Hosting = Omit<HostingInput, "renewal_responsibility" | "billing_cycle"> & Stamps & {
  renewal_responsibility: HostingInput["renewal_responsibility"] | null;
  billing_cycle: HostingInput["billing_cycle"] | null;
};
export type Renewal = RenewalInput & {
  id: string; domain_id: string | null; hosting_service_id: string | null; created_at: string;
};
export type AssetProject = Pick<Project, "id" | "name"> & { clients: Pick<Client, "id" | "name"> };
export type AssetAccount = Pick<ServiceAccount, "id" | "label" | "archived_at" | "vault_item_id" | "login_url"> & {
  service_providers: Pick<ServiceProvider, "id" | "name" | "dashboard_url">;
};
export type DomainView = Domain & { kind: "domains"; projects: AssetProject; service_accounts: AssetAccount | null };
export type HostingView = Hosting & { kind: "hosting"; projects: AssetProject; service_accounts: AssetAccount };
export type AssetView = DomainView | HostingView;

type Table<Input, Row> = {
  Row: Row;
  Insert: Input;
  Update: Partial<Input>;
};

export type Database = {
  public: {
    Tables: {
      clients: Table<ClientInput, Client & { search_text: string }> & { Relationships: [] };
      projects: Table<ProjectInput, Project & { search_text: string }> & {
        Relationships: [{
          foreignKeyName: "projects_client_id_fkey";
          columns: ["client_id"];
          isOneToOne: false;
          referencedRelation: "clients";
          referencedColumns: ["id"];
        }];
      };
      service_providers: Table<ProviderInput, ServiceProvider> & { Relationships: [] };
      service_accounts: Table<AccountInput & { archived_at?: string | null }, ServiceAccount & { search_text: string }> & {
        Relationships: [{
          foreignKeyName: "service_accounts_provider_id_fkey";
          columns: ["provider_id"];
          isOneToOne: false;
          referencedRelation: "service_providers";
          referencedColumns: ["id"];
        }];
      };
      project_service_accounts: Table<ProjectServiceAssociation & { project_id: string }, ProjectAccount> & {
        Relationships: [{
          foreignKeyName: "project_service_accounts_project_id_fkey";
          columns: ["project_id"];
          isOneToOne: false;
          referencedRelation: "projects";
          referencedColumns: ["id"];
        }, {
          foreignKeyName: "project_service_accounts_service_account_id_fkey";
          columns: ["service_account_id"];
          isOneToOne: false;
          referencedRelation: "service_accounts";
          referencedColumns: ["id"];
        }, {
          foreignKeyName: "project_service_accounts_provider_id_fkey";
          columns: ["provider_id"];
          isOneToOne: false;
          referencedRelation: "service_providers";
          referencedColumns: ["id"];
        }];
      };
      domains: Table<DomainInput, Domain> & {
        Relationships: [{
          foreignKeyName: "domains_project_id_fkey";
          columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"];
        }, {
          foreignKeyName: "domains_registrar_account_id_fkey";
          columns: ["registrar_account_id"]; isOneToOne: false; referencedRelation: "service_accounts"; referencedColumns: ["id"];
        }];
      };
      hosting_services: Table<HostingInput, Hosting & { search_text: string }> & {
        Relationships: [{
          foreignKeyName: "hosting_services_project_id_fkey";
          columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"];
        }, {
          foreignKeyName: "hosting_services_hosting_account_id_fkey";
          columns: ["hosting_account_id"]; isOneToOne: false; referencedRelation: "service_accounts"; referencedColumns: ["id"];
        }];
      };
      renewal_history: Table<Omit<Renewal, "created_at">, Renewal> & { Relationships: [] };
    };
    Views: Record<never, never>;
    Functions: {
      is_hub_admin: { Args: never; Returns: boolean };
      record_asset_renewal: { Args: {
        p_event_id: string; p_kind: string; p_record_id: string; p_renewed_on: string;
        p_period_start: string | null; p_period_end: string | null; p_paid_amount: number | null;
        p_currency: string | null; p_paid_on: string | null; p_payment_status: string;
        p_next_renewal_on: string | null; p_notes: string | null;
      }; Returns: string };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export const clientColumns = "id,name,company,contact_person,email,phone,website,country,city,address,status,notes,created_at,updated_at";
export const projectColumns = "id,client_id,name,website,project_type,description,status,technology_stack,repository_url,cms_url,production_url,staging_url,technical_notes,created_at,updated_at";
export const listedProjectColumns = `${projectColumns},clients!inner(id,name)` as const;
