// packages/cli/src/commands/log.ts
import chalk from 'chalk';
import { getAuthenticatedClient } from '../auth.js';
import { requireLocalConfig } from '../config.js';

export async function logCommand(): Promise<void> {
  const config = requireLocalConfig();
  const client = await getAuthenticatedClient();

  // Get project name
  const { data: project } = await client
    .from('projects')
    .select('name, parent_id')
    .eq('id', config.project_id)
    .single();

  console.log(chalk.bold(`Decision Ledger: ${project?.name || 'Unknown'}\n`));

  // Get all decisions for this project
  const { data: decisions, error } = await client
    .from('decisions')
    .select('id, decision, rationale, alternatives, supersedes_id, propagate, git_ref, created_at')
    .eq('project_id', config.project_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(chalk.red(`Failed to fetch decisions: ${error.message}`));
    process.exit(1);
  }

  // Get propagated decisions from children
  const { data: children } = await client
    .from('projects')
    .select('id, name')
    .eq('parent_id', config.project_id);

  let propagated: any[] = [];
  if (children && children.length > 0) {
    const childIds = children.map((c: any) => c.id);
    const { data } = await client
      .from('decisions')
      .select('id, project_id, decision, rationale, alternatives, supersedes_id, propagate, git_ref, created_at')
      .in('project_id', childIds)
      .eq('propagate', true)
      .order('created_at', { ascending: false });
    propagated = data || [];
  }

  // Merge and identify superseded
  const all = [...(decisions || []), ...propagated];
  const supersededIds = new Set(all.filter((d) => d.supersedes_id).map((d) => d.supersedes_id));

  if (all.length === 0) {
    console.log(chalk.dim('No decisions recorded yet.'));
    return;
  }

  for (const d of all) {
    const isSuperseded = supersededIds.has(d.id);
    const isPropagated = propagated.some((p) => p.id === d.id);

    const prefix = isSuperseded ? chalk.strikethrough.dim : (s: string) => s;
    const tags: string[] = [];
    if (isSuperseded) tags.push(chalk.dim('[superseded]'));
    if (isPropagated) {
      const source = children?.find((c: any) => c.id === d.project_id);
      tags.push(chalk.blue(`[from: ${source?.name || 'child'}]`));
    }
    if (d.propagate && !isPropagated) tags.push(chalk.cyan('[propagated]'));
    if (d.git_ref) tags.push(chalk.dim(`[${d.git_ref}]`));

    console.log(`${prefix(chalk.bold(d.decision))} ${tags.join(' ')}`);
    console.log(`  ${chalk.dim(d.rationale)}`);
    if (d.alternatives) console.log(`  ${chalk.dim(`Alternatives: ${d.alternatives}`)}`);
    console.log(`  ${chalk.dim(new Date(d.created_at).toLocaleDateString())}`);
    console.log('');
  }
}
