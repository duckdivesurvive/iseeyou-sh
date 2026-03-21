# Supabase Schema Tests

## How to run

These tests are SQL scripts that run against a Supabase database
with all migrations applied.

### Prerequisites
- A Supabase project (local or remote)
- All migrations in `supabase/migrations/` applied in order

### Running tests

1. Apply all migrations to your test database
2. Run the test file:

   ```bash
   psql <your-connection-string> -f tests/supabase/test_schema.sql
   ```

3. All assertions use PL/pgSQL `ASSERT`. A passing test prints
   `NOTICE: PASS: ...`. A failing test raises an exception with
   the assertion message.

### What's tested
- All enums exist with correct value counts
- All tables exist with correct column counts
- Unique constraints are in place
- Triggers and trigger functions exist
- RLS is enabled on all tables
