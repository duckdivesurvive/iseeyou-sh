// packages/cli/src/commands/backup.ts
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadCredentials } from '../auth.js';

export async function backupCommand(options: { output?: string }): Promise<void> {
  const creds = loadCredentials();
  const supabaseUrl = process.env.SUPABASE_URL || creds?.supabase_url || 'http://127.0.0.1:54351';

  // Extract host and port from Supabase URL to find the DB port
  // Local Supabase API is on port X, DB is typically on X+1
  const urlObj = new URL(supabaseUrl);
  const apiPort = parseInt(urlObj.port || '54351', 10);
  const dbPort = apiPort + 1;
  const dbHost = urlObj.hostname;

  // Determine output path
  let outputPath: string;
  if (options.output) {
    outputPath = options.output;
  } else {
    // Default: supabase/seed.sql in the project that has supabase/ dir
    const supabaseDir = findSupabaseDir(process.cwd());
    if (supabaseDir) {
      outputPath = join(supabaseDir, 'seed.sql');
    } else {
      outputPath = join(process.cwd(), 'seed.sql');
    }
  }

  console.log(chalk.bold('Backing up iseeyou.sh database...\n'));
  console.log(chalk.dim(`  DB: ${dbHost}:${dbPort}`));
  console.log(chalk.dim(`  Output: ${outputPath}\n`));

  // Check pg_dump is available
  try {
    execSync('which pg_dump', { stdio: 'pipe' });
  } catch {
    console.error(chalk.red('pg_dump not found. Install PostgreSQL client tools.'));
    process.exit(1);
  }

  // Dump public schema data only (schema comes from migrations)
  const tables = ['workspaces', 'projects', 'project_permissions', 'project_models', 'decisions', 'task_states'];
  const tableArgs = tables.map(t => `-t "public.${t}"`).join(' ');

  try {
    const result = execSync(
      `PGPASSWORD=postgres pg_dump -h ${dbHost} -p ${dbPort} -U postgres -d postgres ` +
      `--data-only --inserts --no-owner --no-privileges ${tableArgs}`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    // Wrap in transaction and add replication role for FK safety
    const seed = [
      '-- iseeyou.sh database backup',
      `-- Generated: ${new Date().toISOString()}`,
      '-- Restores public table data only (schema comes from migrations)',
      '',
      'SET session_replication_role = replica;',
      '',
      'BEGIN;',
      '',
      // Truncate in reverse FK order before inserting
      ...tables.reverse().map(t => `TRUNCATE TABLE "public"."${t}" CASCADE;`),
      '',
      result.trim(),
      '',
      'COMMIT;',
      '',
      'SET session_replication_role = DEFAULT;',
      '',
    ].join('\n');

    const dir = join(outputPath, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(outputPath, seed);

    const lines = result.split('\n').filter(l => l.startsWith('INSERT')).length;
    console.log(chalk.green(`Backup complete: ${lines} rows saved.`));
    console.log(chalk.dim(`\nThis file will auto-restore on \`supabase start\` if placed at supabase/seed.sql`));
  } catch (err: any) {
    console.error(chalk.red('Backup failed:'), err.stderr || err.message);
    process.exit(1);
  }
}

function findSupabaseDir(from: string): string | null {
  let dir = from;
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, 'supabase');
    if (existsSync(join(candidate, 'config.toml'))) {
      return candidate;
    }
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
