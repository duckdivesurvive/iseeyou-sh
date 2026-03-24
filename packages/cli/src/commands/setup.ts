// packages/cli/src/commands/setup.ts
import { input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const TEST_EMAIL = 'dev@iseeyou.local';
const TEST_PASSWORD = 'localdev123';

function getMigrationsDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  // In dist: dist/commands/setup.js -> dist/migrations/
  // In src: src/commands/setup.ts -> src/migrations/
  const dir = join(dirname(dirname(thisFile)), 'migrations');
  if (existsSync(dir)) return dir;
  // Also check sibling to dist
  const alt = join(dirname(dirname(dirname(thisFile))), 'src', 'migrations');
  if (existsSync(alt)) return alt;
  throw new Error('Could not find bundled migrations');
}

export async function setupCommand(): Promise<void> {
  console.log(chalk.bold('iseeyou.sh setup\n'));
  console.log(chalk.dim('This sets up your local database and credentials.\n'));

  // Step 1: Check if Supabase CLI is available
  try {
    execSync('supabase --version', { stdio: 'pipe' });
  } catch {
    console.error(chalk.red('Supabase CLI not found.'));
    console.error(chalk.dim('Install it: npm install -g supabase'));
    process.exit(1);
  }

  // Step 2: Check if Docker is running
  try {
    execSync('docker info', { stdio: 'pipe' });
  } catch {
    console.error(chalk.red('Docker is not running.'));
    console.error(chalk.dim('Start Docker Desktop or the Docker daemon first.'));
    process.exit(1);
  }

  // Step 3: Set up Supabase project directory
  const supabaseDir = join(homedir(), '.uberclaude', 'supabase');
  const migrationsTarget = join(supabaseDir, 'supabase', 'migrations');

  if (!existsSync(join(supabaseDir, 'supabase', 'config.toml'))) {
    console.log(chalk.dim('1. Setting up Supabase project...'));
    mkdirSync(supabaseDir, { recursive: true });

    // Init supabase in that directory
    try {
      execSync('supabase init', { cwd: supabaseDir, stdio: 'pipe' });
    } catch {
      // config.toml might already exist
    }

    // Configure unique ports to avoid conflicts
    const configPath = join(supabaseDir, 'supabase', 'config.toml');
    if (existsSync(configPath)) {
      let config = readFileSync(configPath, 'utf-8');
      config = config.replace(/port = 54321/g, 'port = 54371');
      config = config.replace(/port = 54322/g, 'port = 54372');
      config = config.replace(/shadow_port = 54320/g, 'shadow_port = 54370');
      config = config.replace(/port = 54323/g, 'port = 54373');
      config = config.replace(/port = 54324/g, 'port = 54374');
      config = config.replace(/port = 54327/g, 'port = 54377');
      config = config.replace(/port = 54329/g, 'port = 54379');
      config = config.replace(/inspector_port = 8083/g, 'inspector_port = 8094');
      // Set project ID
      config = config.replace(/project_id = ".*"/, 'project_id = "iseeyou-sh"');
      writeFileSync(configPath, config);
    }
    console.log(chalk.green('  Supabase project initialized'));
  } else {
    console.log(chalk.dim('1. Supabase project already exists'));
  }

  // Step 4: Copy migrations
  console.log(chalk.dim('2. Copying database migrations...'));
  mkdirSync(migrationsTarget, { recursive: true });

  const migrationsSource = getMigrationsDir();
  const migrationFiles = readdirSync(migrationsSource).filter((f) => f.endsWith('.sql')).sort();

  for (const file of migrationFiles) {
    const src = join(migrationsSource, file);
    const dst = join(migrationsTarget, file);
    writeFileSync(dst, readFileSync(src, 'utf-8'));
  }
  console.log(chalk.green(`  ${migrationFiles.length} migrations copied`));

  // Step 5: Start Supabase
  console.log(chalk.dim('3. Starting Supabase (this may take a minute)...'));
  try {
    const output = execSync('supabase start', {
      cwd: supabaseDir,
      stdio: 'pipe',
      timeout: 300000,
    }).toString();

    console.log(chalk.green('  Supabase started'));

    // Parse the output for keys
    const urlMatch = output.match(/Project URL[^\n]*│\s*(http[^\s]+)/);
    const anonMatch = output.match(/Publishable[^\n]*│\s*(\S+)/);
    const secretMatch = output.match(/Secret\s*│\s*(\S+)/);

    const supabaseUrl = urlMatch?.[1] || 'http://127.0.0.1:54371';
    const anonKey = anonMatch?.[1] || '';
    const serviceRoleKey = secretMatch?.[1] || '';

    if (!anonKey || !serviceRoleKey) {
      console.log(chalk.yellow('  Could not parse keys from output. Run `supabase status` in ~/.uberclaude/supabase/ to get them.'));
      console.log(chalk.dim('  Then run `iseeyou-sh setup` again.'));
      return;
    }

    // Step 6: Create user
    console.log(chalk.dim('4. Creating local user...'));
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let userId: string;
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });

    if (createError && createError.message.includes('already been registered')) {
      const { data: users } = await admin.auth.admin.listUsers();
      const existing = users?.users.find((u: any) => u.email === TEST_EMAIL);
      userId = existing?.id || '';
      console.log(chalk.dim(`  User already exists: ${TEST_EMAIL}`));
    } else if (createError) {
      console.error(chalk.red(`  Failed to create user: ${createError.message}`));
      return;
    } else {
      userId = newUser.user.id;
      console.log(chalk.green(`  User created: ${TEST_EMAIL}`));
    }

    // Step 7: Sign in and save credentials
    console.log(chalk.dim('5. Saving credentials...'));
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: session, error: signInError } = await anonClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (signInError || !session.session) {
      console.error(chalk.red(`  Sign in failed: ${signInError?.message || 'no session'}`));
      return;
    }

    const credPath = join(homedir(), '.uberclaude', 'credentials.json');
    writeFileSync(credPath, JSON.stringify({
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
      supabase_url: supabaseUrl,
      supabase_anon_key: anonKey,
      supabase_service_role_key: serviceRoleKey,
      monorepo_path: supabaseDir,
    }, null, 2), { mode: 0o600 });

    console.log(chalk.green(`  Credentials saved to ${credPath}`));

    console.log(chalk.green('\n✓ Setup complete!\n'));
    console.log('Next steps:');
    console.log(chalk.dim(`  cd ~/your-project`));
    console.log(chalk.dim(`  iseeyou-sh init`));
    console.log('');
    console.log(chalk.dim(`Dashboard login: ${TEST_EMAIL} / ${TEST_PASSWORD}`));

  } catch (err: any) {
    if (err.message?.includes('port')) {
      console.error(chalk.red('  Port conflict — another Supabase instance may be running.'));
      console.error(chalk.dim('  Check with: docker ps | grep supabase'));
    } else {
      console.error(chalk.red(`  Failed to start Supabase: ${err.message}`));
    }
  }
}
