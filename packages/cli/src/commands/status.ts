// packages/cli/src/commands/status.ts
import chalk from 'chalk';
import { getAuthenticatedClient } from '../auth.js';
import { requireLocalConfig } from '../config.js';

export async function statusCommand(): Promise<void> {
  const config = requireLocalConfig();
  const client = await getAuthenticatedClient();

  // Get project info
  const { data: project } = await client
    .from('projects')
    .select('name, slug, parent_id')
    .eq('id', config.project_id)
    .single();

  if (!project) {
    console.error(chalk.red('Project not found.'));
    process.exit(1);
  }

  console.log(chalk.bold(`${project.name} (${project.slug})\n`));

  // Get permissions
  const { data: perms } = await client
    .from('project_permissions')
    .select('category, level')
    .eq('project_id', config.project_id);

  if (perms && perms.length > 0) {
    console.log(chalk.bold('Permissions:'));
    for (const perm of perms) {
      const color = perm.level === 'write' ? chalk.green : perm.level === 'read' ? chalk.yellow : chalk.red;
      console.log(`  ${perm.category}: ${color(perm.level)}`);
    }
    console.log('');
  }

  // Get task state
  const { data: taskState } = await client
    .from('task_states')
    .select('in_progress, completed, blocked, next, updated_at')
    .eq('project_id', config.project_id)
    .single();

  if (taskState) {
    console.log(chalk.bold('Task State:'));
    if (taskState.in_progress?.length > 0) {
      console.log(chalk.cyan('  In Progress:'));
      for (const item of taskState.in_progress) console.log(`    - ${item}`);
    }
    if (taskState.blocked?.length > 0) {
      console.log(chalk.red('  Blocked:'));
      for (const item of taskState.blocked) console.log(`    - ${item}`);
    }
    if (taskState.completed?.length > 0) {
      console.log(chalk.green('  Completed:'));
      for (const item of taskState.completed) console.log(`    - ${item}`);
    }
    if (taskState.next?.length > 0) {
      console.log(chalk.dim('  Next:'));
      for (const item of taskState.next) console.log(`    - ${item}`);
    }
    console.log(chalk.dim(`\n  Last updated: ${taskState.updated_at}`));
  } else {
    console.log(chalk.dim('No task state recorded yet.'));
  }
}
