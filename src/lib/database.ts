import type { ClientInput, ProjectInput } from "./validation";

import type { AccountInput, AssociationInput, ProviderInput } from "./service-validation";

export type Stamps = { id: string; created_at: string; updated_at: string };
export type Client = ClientInput & Stamps;
export type Project = ProjectInput & Stamps;
export type ListedProject = Project & { clients: Pick<Client, "id" | "name"> };
export type ClientOption = Pick<Client, "id" | "name" | "status">;

export type ServiceProvider = ProviderInput & Stamps;
export type ServiceAccount = AccountInput & Stamps & { archived_at: string | null };
export type ProjectAccount = AssociationInput & Stamps & { project_id: string };
export type ListedAccount = ServiceAccount & { service_providers: Pick<ServiceProvider, "id" | "name" | "dashboard_url"> };
export type ProjectAccountView = ProjectAccount & { service_accounts: ListedAccount };
export type AccountProjectView = ProjectAccount & { projects: Pick<Project, "id" | "name" | "status"> };

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
      project_service_accounts: Table<AssociationInput & { project_id: string }, ProjectAccount> & {
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
        }];
      };
    };
    Views: Record<never, never>;
    Functions: { is_hub_admin: { Args: never; Returns: boolean } };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export const clientColumns = "id,name,company,contact_person,email,phone,website,country,city,address,status,notes,created_at,updated_at";
export const projectColumns = "id,client_id,name,website,project_type,description,status,technology_stack,repository_url,cms_url,production_url,staging_url,technical_notes,created_at,updated_at";
export const listedProjectColumns = `${projectColumns},clients!inner(id,name)` as const;
