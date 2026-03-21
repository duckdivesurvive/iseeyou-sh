-- supabase/migrations/00007_create_task_states.sql

CREATE TABLE task_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  in_progress text[] NOT NULL DEFAULT '{}',
  completed text[] NOT NULL DEFAULT '{}',
  blocked text[] NOT NULL DEFAULT '{}',
  next text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
