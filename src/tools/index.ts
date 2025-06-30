import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { CREATE_MERMAID_DIAGRAM_TOOL, handleCreateMermaidDiagram } from "./mermaid.js";

export const TOOLS: Tool[] = [
  CREATE_MERMAID_DIAGRAM_TOOL
];

export const TOOL_HANDLERS: Record<string, (args: any) => Promise<any>> = {
  "create-mermaid-diagram": handleCreateMermaidDiagram
};