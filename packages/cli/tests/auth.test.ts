// packages/cli/tests/auth.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { saveCredentials, loadCredentials, getAuthenticatedClient } from '../src/auth';

const testDir = join(tmpdir(), `uc-test-${Date.now()}`);

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('saveCredentials', () => {
  it('saves JWT to credentials file', () => {
    const credPath = join(testDir, 'credentials.json');
    saveCredentials(credPath, {
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      supabase_url: 'http://localhost:54351',
    });
    expect(existsSync(credPath)).toBe(true);
  });
});

describe('loadCredentials', () => {
  it('returns null when no credentials file exists', () => {
    const result = loadCredentials(join(testDir, 'nonexistent.json'));
    expect(result).toBeNull();
  });

  it('returns saved credentials', () => {
    const credPath = join(testDir, 'credentials.json');
    const creds = {
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      supabase_url: 'http://localhost:54351',
    };
    saveCredentials(credPath, creds);
    const loaded = loadCredentials(credPath);
    expect(loaded).toEqual(creds);
  });
});
