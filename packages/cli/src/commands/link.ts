// packages/cli/src/commands/link.ts
import chalk from 'chalk';
import { getAuthenticatedClient } from '../auth.js';
import { readProjectConfig, writeLocalConfig } from '../config.js';

export async function linkCommand(): Promise<void> {
  console.log(chalk.bold('uberclaude link\n'));

  const cwd = process.cwd();
  const projectConfig = readProjectConfig(cwd);

  if (!projectConfig) {
    console.error(chalk.red('No .uberclaude file found in current directory.'));
    console.error(chalk.dim('Run `uc init` to set up a new project, or copy a .uberclaude file from a team member.'));
    process.exit(1);
  }

  const client = await getAuthenticatedClient();

  // Resolve workspace slug to ID
  const { data: workspace, error: wsError } = await client
    .from('workspaces')
    .select('id')
    .eq('slug', projectConfig.workspace)
    .single();

  if (wsError || !workspace) {
    console.error(chalk.red(`Workspace "${projectConfig.workspace}" not found.`));
    process.exit(1);
  }

  // Resolve project slug to ID
  const { data: project, error: projError } = await client
    .from('projects')
    .select('id, name')
    .eq('workspace_id', workspace.id)
    .eq('slug', projectConfig.project)
    .single();

  if (projError || !project) {
    console.error(chalk.red(`Project "${projectConfig.project}" not found in workspace "${projectConfig.workspace}".`));
    process.exit(1);
  }

  writeLocalConfig(cwd, {
    project_id: project.id,
    workspace_id: workspace.id,
  });

  console.log(chalk.green(`✓ Linked to "${project.name}" (${projectConfig.workspace}/${projectConfig.project})`));
  console.log(chalk.dim(`  .uberclaude.local written`));
}
