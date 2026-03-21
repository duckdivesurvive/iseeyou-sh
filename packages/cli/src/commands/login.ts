// packages/cli/src/commands/login.ts
import { createClient } from '@supabase/supabase-js';
import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import { saveCredentials, getCredentialsPath } from '../auth.js';

const DEFAULT_SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54351';
const DEFAULT_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

export async function loginCommand(): Promise<void> {
  console.log(chalk.bold('uberclaude login\n'));

  const supabaseUrl = await input({
    message: 'Supabase URL:',
    default: DEFAULT_SUPABASE_URL,
  });

  const anonKey = await input({
    message: 'Supabase anon/publishable key:',
    default: DEFAULT_SUPABASE_ANON_KEY,
  });

  const email = await input({
    message: 'Email address:',
  });

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(chalk.dim(`\nSending magic link to ${email}...`));

  const { error: otpError } = await client.auth.signInWithOtp({ email });

  if (otpError) {
    console.error(chalk.red(`Failed to send magic link: ${otpError.message}`));
    process.exit(1);
  }

  console.log(chalk.green(`Magic link sent! Check your email.`));

  const token = await input({
    message: 'Paste the token from the magic link (or the OTP code):',
  });

  // Try to verify as OTP
  const { data, error } = await client.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });

  if (error) {
    console.error(chalk.red(`Login failed: ${error.message}`));
    process.exit(1);
  }

  if (!data.session) {
    console.error(chalk.red('Login succeeded but no session returned.'));
    process.exit(1);
  }

  saveCredentials(getCredentialsPath(), {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    supabase_url: supabaseUrl,
  });

  console.log(chalk.green(`\nLogged in as ${email}`));
  console.log(chalk.dim(`Credentials saved to ${getCredentialsPath()}`));
}
