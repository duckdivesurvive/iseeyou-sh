#!/usr/bin/env node
// packages/mcp/src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getSupabaseClient } from './supabase.js';
import { registerCreateProjectTool } from './tools/uc_create_project.js';
import { registerGetContextTool } from './tools/uc_get_context.js';
import { registerLogDecisionTool } from './tools/uc_log_decision.js';
import { registerUpdateStateTool } from './tools/uc_update_state.js';
import { registerGetProjectModelTool } from './tools/uc_get_project_model.js';
import { registerListProjectsTool } from './tools/uc_list_projects.js';
import { registerSetPermissionsTool } from './tools/uc_set_permissions.js';
import { registerUpdateModelTool } from './tools/uc_update_model.js';

async function main() {
  const server = new McpServer({
    name: 'uberclaude',
    version: '0.1.0',
  });

  const client = getSupabaseClient();

  // Register all 8 tools
  registerCreateProjectTool(server, client);
  registerGetContextTool(server, client);
  registerLogDecisionTool(server, client);
  registerUpdateStateTool(server, client);
  registerGetProjectModelTool(server, client);
  registerListProjectsTool(server, client);
  registerSetPermissionsTool(server, client);
  registerUpdateModelTool(server, client);

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('uberclaude MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
