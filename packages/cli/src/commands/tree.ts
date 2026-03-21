// packages/cli/src/commands/tree.ts
import chalk from 'chalk';
import { getAuthenticatedClient } from '../auth.js';
import { requireLocalConfig } from '../config.js';

interface ProjectWithPerms {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  permissions: Record<string, string>;
}

export function formatTree(projects: ProjectWithPerms[]): string {
  const lines: string[] = [];
  const roots = projects.filter((p) => !p.parent_id);
  const childrenOf = (parentId: string) => projects.filter((p) => p.parent_id === parentId);

  function render(project: ProjectWithPerms, prefix: string, isLast: boolean, isRoot: boolean) {
    const connector = isRoot ? '' : isLast ? '└── ' : '├── ';
    const permStr = Object.entries(project.permissions)
      .map(([k, v]) => {
        const color = v === 'write' ? chalk.green(v) : v === 'read' ? chalk.yellow(v) : chalk.red(v);
        return `${k}:${color}`;
      })
      .join(' ');

    lines.push(`${prefix}${connector}${chalk.bold(project.name)} ${chalk.dim(`(${project.slug})`)} [${permStr}]`);

    const children = childrenOf(project.id);
    const childPrefix = prefix + (isRoot ? '' : isLast ? '    ' : '│   ');
    children.forEach((child, i) => {
      render(child, childPrefix, i === children.length - 1, false);
    });
  }

  roots.forEach((root, i) => render(root, '', i === roots.length - 1, true));
  return lines.join('\n');
}

export async function treeCommand(): Promise<void> {
  const config = requireLocalConfig();
  const client = await getAuthenticatedClient();

  // Fetch all projects in workspace
  const { data: projects, error } = await client
    .from('projects')
    .select('id, name, slug, parent_id')
    .eq('workspace_id', config.workspace_id)
    .order('created_at');

  if (error) {
    console.error(chalk.red(`Failed to fetch projects: ${error.message}`));
    process.exit(1);
  }

  // Fetch permissions for all projects
  const projectIds = (projects || []).map((p: any) => p.id);
  const { data: allPerms } = await client
    .from('project_permissions')
    .select('project_id, category, level')
    .in('project_id', projectIds);

  const permsByProject: Record<string, Record<string, string>> = {};
  for (const perm of allPerms || []) {
    if (!permsByProject[perm.project_id]) permsByProject[perm.project_id] = {};
    permsByProject[perm.project_id][perm.category] = perm.level;
  }

  const projectsWithPerms: ProjectWithPerms[] = (projects || []).map((p: any) => ({
    ...p,
    permissions: permsByProject[p.id] || {},
  }));

  console.log(chalk.bold('Project Tree\n'));
  console.log(formatTree(projectsWithPerms));
}
