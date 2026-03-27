// packages/cli/src/commands/register.ts
// Registers the iseeyou.sh MCP server globally with Claude Code
import chalk from 'chalk';
import { execSync, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadCredentials } from '../auth.js';
import { getMonorepoRoot } from '../config.js';

export async function registerCommand(): Promise<void> {
  // Check claude CLI exists
  try {
    execSync('which claude', { stdio: 'pipe' });
  } catch {
    console.error(chalk.red('claude CLI not found. Install Claude Code first.'));
    process.exit(1);
  }

  const creds = loadCredentials();
  if (!creds) {
    console.error(chalk.red('Not set up yet. Run `iseeyou-sh setup` first.'));
    process.exit(1);
  }

  const supabaseUrl = creds.supabase_url;
  const serviceRoleKey = creds.supabase_service_role_key;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(chalk.red('Missing Supabase credentials. Run `iseeyou-sh setup` first.'));
    process.exit(1);
  }

  const root = getMonorepoRoot();
  if (!root) {
    console.error(chalk.red('Cannot find iseeyou.sh packages. Is it installed?'));
    process.exit(1);
  }

  const mcpServerPath = join(root, 'packages', 'mcp', 'src', 'index.ts');
  if (!existsSync(mcpServerPath)) {
    console.error(chalk.red(`MCP server not found at ${mcpServerPath}`));
    process.exit(1);
  }

  console.log(chalk.bold('Registering iseeyou.sh MCP server with Claude Code...\n'));

  // Remove existing registration first (ignore errors if not found)
  try {
    execFileSync('claude', ['mcp', 'remove', '--scope', 'user', 'uberclaude'], { stdio: 'pipe' });
    console.log(chalk.dim('  Removed existing registration'));
  } catch {
    // Not registered yet, that's fine
  }

  // Register globally — name must come before -e (variadic flag eats subsequent args)
  const args = [
    'mcp', 'add',
    'uberclaude',
    '--scope', 'user',
    '-e', `SUPABASE_URL=${supabaseUrl}`,
    `-e`, `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
    '--',
    'npx', 'tsx', mcpServerPath,
  ];

  try {
    execFileSync('claude', args, { stdio: 'pipe' });
    console.log(chalk.green('  MCP server registered globally.\n'));
    console.log(chalk.dim('  The iseeyou.sh tools are now available in every Claude Code session.'));
    console.log(chalk.dim('  No .mcp.json needed in individual projects.\n'));
    console.log(chalk.dim('  To verify: claude mcp list'));
  } catch (err: any) {
    console.error(chalk.red('Failed to register MCP server:'), err.stderr?.toString() || err.message);
    process.exit(1);
  }
}
