// packages/cli/tests/commands/tree.test.ts
import { describe, it, expect } from 'vitest';
import { formatTree } from '../../src/commands/tree';

describe('formatTree', () => {
  it('renders a simple tree', () => {
    const projects = [
      { id: '1', name: 'Root', slug: 'root', parent_id: null, permissions: { codebase: 'write', domain: 'write' } },
      { id: '2', name: 'Child', slug: 'child', parent_id: '1', permissions: { codebase: 'read', domain: 'read' } },
    ];
    const output = formatTree(projects);
    expect(output).toContain('Root');
    expect(output).toContain('Child');
    expect(output).toContain('codebase:write');
    expect(output).toContain('codebase:read');
  });
});
