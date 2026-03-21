// packages/cli/src/commands/permissions.ts
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { getAuthenticatedClient } from '../auth.js';
import { requireLocalConfig } from '../config.js';

const LEVEL_ORDER: Record<string, number> = { none: 0, read: 1, write: 2 };

export async function permissionsCommand(
  category?: string,
  level?: string
): Promise<void> {
  const config = requireLocalConfig();
  const client = await getAuthenticatedClient();

  // If no args, show current permissions
  if (!category || !level) {
    const { data: perms } = await client
      .from('project_permissions')
      .select('category, level')
      .eq('project_id', config.project_id)
      .order('category');

    console.log(chalk.bold('Permissions:\n'));
    for (const perm of perms || []) {
      const color = perm.level === 'write' ? chalk.green : perm.level === 'read' ? chalk.yellow : chalk.red;
      console.log(`  ${perm.category}: ${color(perm.level)}`);
    }
    return;
  }

  // Validate inputs
  const validCategories = ['codebase', 'domain', 'decisions', 'conventions', 'task_state'];
  const validLevels = ['none', 'read', 'write'];

  if (!validCategories.includes(category)) {
    console.error(chalk.red(`Invalid category: ${category}. Valid: ${validCategories.join(', ')}`));
    process.exit(1);
  }
  if (!validLevels.includes(level)) {
    console.error(chalk.red(`Invalid level: ${level}. Valid: ${validLevels.join(', ')}`));
    process.exit(1);
  }

  // Check if this would affect children
  const { data: children } = await client
    .from('projects')
    .select('id, name')
    .eq('parent_id', config.project_id);

  const affectedChildren: { name: string; currentLevel: string }[] = [];

  if (children && children.length > 0) {
    for (const child of children) {
      const { data: childPerm } = await client
        .from('project_permissions')
        .select('level')
        .eq('project_id', child.id)
        .eq('category', category)
        .single();

      if (childPerm && LEVEL_ORDER[childPerm.level] > LEVEL_ORDER[level]) {
        affectedChildren.push({ name: child.name, currentLevel: childPerm.level });
      }
    }
  }

  if (affectedChildren.length > 0) {
    console.log(chalk.yellow('\nThis change will affect child projects:'));
    for (const child of affectedChildren) {
      console.log(chalk.yellow(`  ${child.name}: ${child.currentLevel} → ${level}`));
    }

    const proceed = await confirm({ message: 'Proceed with downgrade?', default: false });
    if (!proceed) {
      console.log(chalk.dim('Cancelled.'));
      return;
    }
  }

  // Update permission
  const { error } = await client
    .from('project_permissions')
    .update({ level })
    .eq('project_id', config.project_id)
    .eq('category', category);

  if (error) {
    console.error(chalk.red(`Failed to update: ${error.message}`));
    process.exit(1);
  }

  // Cascade to children
  for (const child of affectedChildren) {
    const childRecord = children!.find((c: any) => c.name === child.name);
    if (childRecord) {
      await client
        .from('project_permissions')
        .update({ level })
        .eq('project_id', childRecord.id)
        .eq('category', category);
    }
  }

  console.log(chalk.green(`✓ ${category} set to ${level}`));
  if (affectedChildren.length > 0) {
    console.log(chalk.dim(`  ${affectedChildren.length} child project(s) updated`));
  }
}
