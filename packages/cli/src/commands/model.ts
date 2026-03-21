// packages/cli/src/commands/model.ts
import chalk from 'chalk';
import { getAuthenticatedClient } from '../auth.js';
import { requireLocalConfig } from '../config.js';

export async function modelCommand(action?: string, ...args: string[]): Promise<void> {
  const config = requireLocalConfig();
  const client = await getAuthenticatedClient();

  if (action === 'add') {
    return modelAddCommand(client, config.project_id, args);
  }

  // Default: browse model entries
  const { data: entries, error } = await client
    .from('project_models')
    .select('category, key, value, updated_at')
    .eq('project_id', config.project_id)
    .order('category')
    .order('key');

  if (error) {
    console.error(chalk.red(`Failed to fetch model: ${error.message}`));
    process.exit(1);
  }

  if (!entries || entries.length === 0) {
    console.log(chalk.dim('No model entries yet. Use `uc model add <category> <key> <value>` to add one.'));
    return;
  }

  // Group by category
  const byCategory: Record<string, typeof entries> = {};
  for (const entry of entries) {
    if (!byCategory[entry.category]) byCategory[entry.category] = [];
    byCategory[entry.category].push(entry);
  }

  for (const [category, catEntries] of Object.entries(byCategory)) {
    console.log(chalk.bold(`\n${category.charAt(0).toUpperCase() + category.slice(1)}`));
    for (const entry of catEntries) {
      console.log(`  ${chalk.cyan(entry.key)}: ${entry.value}`);
    }
  }
}

async function modelAddCommand(
  client: any,
  projectId: string,
  args: string[]
): Promise<void> {
  if (args.length < 3) {
    console.error(chalk.red('Usage: uc model add <category> <key> <value>'));
    console.error(chalk.dim('  Categories: codebase, domain, decisions, conventions'));
    process.exit(1);
  }

  const [category, key, ...valueParts] = args;
  const value = valueParts.join(' ');

  const validCategories = ['codebase', 'domain', 'decisions', 'conventions'];
  if (!validCategories.includes(category)) {
    console.error(chalk.red(`Invalid category: ${category}. Valid: ${validCategories.join(', ')}`));
    process.exit(1);
  }

  // Check write permission
  const { data: perm } = await client
    .from('project_permissions')
    .select('level')
    .eq('project_id', projectId)
    .eq('category', category)
    .single();

  if (!perm || perm.level !== 'write') {
    console.error(chalk.red(`Permission denied: ${category} is ${perm?.level || 'none'} (need write)`));
    process.exit(1);
  }

  const { error } = await client
    .from('project_models')
    .upsert(
      { project_id: projectId, category, key, value },
      { onConflict: 'project_id,category,key' }
    );

  if (error) {
    console.error(chalk.red(`Failed to add model entry: ${error.message}`));
    process.exit(1);
  }

  console.log(chalk.green(`✓ ${category}/${key} saved`));
}
