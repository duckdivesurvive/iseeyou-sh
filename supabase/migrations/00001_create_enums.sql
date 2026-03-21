-- supabase/migrations/00001_create_enums.sql

-- Context categories that permissions apply to
CREATE TYPE context_category AS ENUM (
  'codebase',
  'domain',
  'decisions',
  'conventions',
  'task_state'
);

-- Permission levels (ordered: none < read < write)
CREATE TYPE permission_level AS ENUM (
  'none',
  'read',
  'write'
);

-- Model entry categories (subset of context_category — task_state has its own table)
CREATE TYPE model_category AS ENUM (
  'codebase',
  'domain',
  'decisions',
  'conventions'
);
