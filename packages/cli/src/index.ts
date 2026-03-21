#!/usr/bin/env node
// packages/cli/src/index.ts
import { Command } from 'commander';
import { loginCommand } from './commands/login.js';
import { initCommand } from './commands/init.js';
import { linkCommand } from './commands/link.js';
import { treeCommand } from './commands/tree.js';
import { statusCommand } from './commands/status.js';
import { logCommand } from './commands/log.js';
import { permissionsCommand } from './commands/permissions.js';
import { modelCommand } from './commands/model.js';

const program = new Command();

program
  .name('uc')
  .description('uberclaude — Hierarchical Project Brain for AI Coding Assistants')
  .version('0.1.0');

program
  .command('login')
  .description('Authenticate with Supabase via magic link')
  .action(loginCommand);

program
  .command('init')
  .description('Set up a new project interactively')
  .action(initCommand);

program
  .command('link')
  .description('Link to an existing project from .uberclaude file')
  .action(linkCommand);

program
  .command('tree')
  .description('Show the project hierarchy for the workspace')
  .action(treeCommand);

program
  .command('status')
  .description('Show current project task state and permissions')
  .action(statusCommand);

program
  .command('log')
  .description('Browse the decision ledger')
  .action(logCommand);

program
  .command('permissions [category] [level]')
  .description('View or update project permissions')
  .action(permissionsCommand);

program
  .command('model [action] [args...]')
  .description('Browse or manage project model entries')
  .action(modelCommand);

program.parse();
