/**
 * Central configuration for Mermaid Live/Ink endpoints and tool enablement
 */

// Default base URLs for different Mermaid services
const DEFAULT_MERMAID_LIVE_BASE = "https://mermaid.live";
const DEFAULT_MERMAID_INK_BASE = "https://mermaid.ink";

/**
 * Get the base URL for Mermaid Live (editor)
 */
function getMermaidLiveBase(): string {
  return process.env.MERMAID_LIVE_BASE_URL || DEFAULT_MERMAID_LIVE_BASE;
}

/**
 * Get the base URL for Mermaid Ink (rendering service)
 */
function getMermaidInkBase(): string {
  return process.env.MERMAID_INK_BASE_URL || DEFAULT_MERMAID_INK_BASE;
}

/**
 * Get URL for a specific Mermaid Live endpoint
 */
export function getMermaidLiveUrl(endpoint: string): string {
  return `${getMermaidLiveBase()}${endpoint}`;
}

/**
 * Get URL for a specific Mermaid Ink endpoint
 */
export function getMermaidInkUrl(endpoint: string): string {
  return `${getMermaidInkBase()}${endpoint}`;
}

/**
 * Predefined endpoint configurations
 */
export const MermaidEndpoints = {
  // Mermaid Live endpoints
  EDIT: "/edit",
  VIEW: "/view",

  // Mermaid Ink endpoints
  IMAGE: "/img",
  SVG: "/svg",
  PDF: "/pdf",
} as const;

/**
 * Get URLs for all Mermaid services
 */
export const MermaidUrls = {
  // Mermaid Live URLs
  edit: (compressed: string) =>
    `${getMermaidLiveBase()}${MermaidEndpoints.EDIT}#pako:${compressed}`,
  view: (compressed: string) =>
    `${getMermaidLiveBase()}${MermaidEndpoints.VIEW}#pako:${compressed}`,

  // Mermaid Ink URLs
  image: (compressed: string) =>
    `${getMermaidInkBase()}${MermaidEndpoints.IMAGE}/pako:${compressed}`,
  svg: (compressed: string) =>
    `${getMermaidInkBase()}${MermaidEndpoints.SVG}/pako:${compressed}`,
  pdf: (compressed: string) =>
    `${getMermaidInkBase()}${MermaidEndpoints.PDF}/pako:${compressed}`,
} as const;

/**
 * Check if a tool is enabled via environment variables
 * Format: MERMAID_ENABLE_<TOOL_NAME>=true/false
 * Default: all tools are enabled
 */
export function isToolEnabled(toolName: string): boolean {
  const envVar = `MERMAID_ENABLE_${toolName.toUpperCase()}`;
  const value = process.env[envVar];

  // If not specified, default to enabled
  if (value === undefined) {
    return true;
  }

  // Parse boolean value
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * Tool name mappings for environment variables
 */
export const ToolNames = {
  CREATE_MERMAID_DIAGRAM: "create_mermaid_diagram",
} as const;
