// packages/cli/src/config.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ProjectConfig {
  workspace: string;
  project: string;
}

export interface LocalConfig {
  project_id: string;
  workspace_id: string;
}

const PROJECT_CONFIG_FILE = '.uberclaude';
const LOCAL_CONFIG_FILE = '.uberclaude.local';

export function writeProjectConfig(dir: string, config: ProjectConfig): void {
  writeFileSync(join(dir, PROJECT_CONFIG_FILE), JSON.stringify(config, null, 2) + '\n');
}

export function readProjectConfig(dir: string): ProjectConfig | null {
  try {
    const content = readFileSync(join(dir, PROJECT_CONFIG_FILE), 'utf-8');
    return JSON.parse(content) as ProjectConfig;
  } catch {
    return null;
  }
}

export function writeLocalConfig(dir: string, config: LocalConfig): void {
  writeFileSync(join(dir, LOCAL_CONFIG_FILE), JSON.stringify(config, null, 2) + '\n');
}

export function readLocalConfig(dir: string): LocalConfig | null {
  try {
    const content = readFileSync(join(dir, LOCAL_CONFIG_FILE), 'utf-8');
    return JSON.parse(content) as LocalConfig;
  } catch {
    return null;
  }
}

export function requireLocalConfig(dir?: string): LocalConfig {
  const config = readLocalConfig(dir || process.cwd());
  if (!config) {
    throw new Error(
      'No .uberclaude.local found. Run `uc init` or `uc link` to set up this project.'
    );
  }
  return config;
}

/**
 * Resolve the root of the uberclaude monorepo (where packages/ lives).
 * Works by walking up from this file's location.
 */
function getUberclaudeRoot(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // thisFile is packages/cli/src/config.ts (or dist/config.js)
  // Walk up to find the monorepo root (has packages/ dir)
  let dir = dirname(thisFile);
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, 'packages', 'mcp')) && existsSync(join(dir, 'packages', 'hooks'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  throw new Error('Could not find uberclaude monorepo root');
}

/**
 * Write .mcp.json for Claude Code MCP server registration.
 */
export function writeClaudeCodeMcpConfig(dir: string, supabaseUrl: string, serviceRoleKey: string): void {
  const root = getUberclaudeRoot();
  const mcpServerPath = join(root, 'packages', 'mcp', 'src', 'index.ts');

  const config = {
    mcpServers: {
      uberclaude: {
        command: 'npx',
        args: ['tsx', mcpServerPath],
        env: {
          SUPABASE_URL: supabaseUrl,
          SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
        },
      },
    },
  };

  writeFileSync(join(dir, '.mcp.json'), JSON.stringify(config, null, 2) + '\n');
}

/**
 * Write Claude Code hooks config for context injection.
 */
export function writeClaudeCodeHooksConfig(dir: string, supabaseUrl: string, serviceRoleKey: string): void {
  const root = getUberclaudeRoot();
  const userPromptScript = join(root, 'packages', 'hooks', 'scripts', 'user-prompt-submit.sh');
  const preCompactScript = join(root, 'packages', 'hooks', 'scripts', 'pre-compact.sh');

  const envPrefix = `SUPABASE_URL=${supabaseUrl} SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`;

  const claudeDir = join(dir, '.claude');
  mkdirSync(claudeDir, { recursive: true });

  const settingsPath = join(claudeDir, 'settings.local.json');

  // Read existing settings if present
  let settings: any = {};
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  } catch {
    // No existing settings
  }

  // Add hooks (preserve existing settings)
  settings.hooks = {
    ...settings.hooks,
    UserPromptSubmit: [
      {
        hooks: [
          {
            type: 'command',
            command: `${envPrefix} bash ${userPromptScript}`,
            timeout: 10,
          },
        ],
      },
    ],
    PreCompact: [
      {
        hooks: [
          {
            type: 'command',
            command: `${envPrefix} bash ${preCompactScript}`,
            timeout: 10,
          },
        ],
      },
    ],
  };

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}
