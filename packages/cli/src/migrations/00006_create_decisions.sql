-- supabase/migrations/00006_create_decisions.sql

CREATE TABLE decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  decision text NOT NULL,
  rationale text NOT NULL,
  alternatives text,
  supersedes_id uuid REFERENCES decisions(id) ON DELETE SET NULL,
  propagate boolean NOT NULL DEFAULT false,
  git_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_decisions_project_id ON decisions(project_id);
CREATE INDEX idx_decisions_supersedes_id ON decisions(supersedes_id);
CREATE INDEX idx_decisions_propagate ON decisions(project_id, propagate) WHERE propagate = true;
