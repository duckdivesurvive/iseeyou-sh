// packages/cli/src/config.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

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
 * Checks: 1) credentials file, 2) env var, 3) walk up from this file.
 */
export function getMonorepoRoot(): string | null {
  // Check credentials
  try {
    const credPath = join(homedir(), '.uberclaude', 'credentials.json');
    const creds = JSON.parse(readFileSync(credPath, 'utf-8'));
    if (creds.monorepo_path && existsSync(join(creds.monorepo_path, 'packages', 'mcp'))) {
      return creds.monorepo_path;
    }
  } catch {}

  // Check env var
  if (process.env.ISEEYOU_ROOT && existsSync(join(process.env.ISEEYOU_ROOT, 'packages', 'mcp'))) {
    return process.env.ISEEYOU_ROOT;
  }

  // Walk up from this file
  const thisFile = fileURLToPath(import.meta.url);
  let dir = dirname(thisFile);
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, 'packages', 'mcp')) && existsSync(join(dir, 'packages', 'hooks'))) {
      return dir;
    }
    dir = dirname(dir);
  }

  return null;
}

/**
 * Write .mcp.json for Claude Code MCP server registration.
 */
export function writeClaudeCodeMcpConfig(dir: string, supabaseUrl: string, serviceRoleKey: string): boolean {
  const root = getMonorepoRoot();
  if (!root) return false;
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
  return true;
}

/**
 * Write Claude Code hooks config for context injection.
 */
export function writeClaudeCodeHooksConfig(dir: string, supabaseUrl: string, serviceRoleKey: string): boolean {
  const root = getMonorepoRoot();
  if (!root) return false;
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
  return true;
}
