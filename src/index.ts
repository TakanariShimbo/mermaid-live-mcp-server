#!/usr/bin/env node

/**
 * Mermaid Live MCP Server
 *
 * This server provides tools to generate Mermaid diagrams using Mermaid Live and Mermaid Ink services.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS, TOOL_HANDLERS } from "./tools/index.js";

// Server Initialization
const server = new Server(
  {
    name: "mermaid-live-server",
    version: "0.3.3",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool List Handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Tool Call Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const handler = TOOL_HANDLERS[name];
    
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    if (!args) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Missing arguments for ${name}`
      );
    }

    return await handler(args);
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Error executing tool ${name}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
});

// Server Startup Function
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Mermaid Live MCP Server running on stdio`);
  console.error(`Available tools: ${TOOLS.map(t => t.name).join(", ")}`);
}

// Server Execution
runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});