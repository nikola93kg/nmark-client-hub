import type { ClientInput, ProjectInput } from "./validation";

type Stamps = { id: string; created_at: string; updated_at: string };
export type Client = ClientInput & Stamps;
export type Project = ProjectInput & Stamps;
export type ListedProject = Project & { clients: Pick<Client, "id" | "name"> };
export type ClientOption = Pick<Client, "id" | "name" | "status">;

type Table<Input, Row> = {
  Row: Row & { search_text: string };
  Insert: Input;
  Update: Partial<Input>;
};

export type Database = {
  public: {
    Tables: {
      clients: Table<ClientInput, Client> & { Relationships: [] };
      projects: Table<ProjectInput, Project> & {
        Relationships: [{
          foreignKeyName: "projects_client_id_fkey";
          columns: ["client_id"];
          isOneToOne: false;
          referencedRelation: "clients";
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
