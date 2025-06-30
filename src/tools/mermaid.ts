import { Tool, McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { getDownloadPath } from "../utils/file.js";
import { MermaidUrls } from "../utils/config.js";

export const CREATE_MERMAID_DIAGRAM_TOOL: Tool = {
  name: "create-mermaid-diagram",
  description:
    "Create a Mermaid diagram - get URLs for editing/viewing/downloading or save diagram to file",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["get_url", "save_file"],
        description: "Whether to get diagram URLs or save diagram as file",
      },
      diagram: {
        type: "string",
        description: "The Mermaid diagram code",
      },
      outputPath: {
        type: "string",
        description:
          "Path where to save the file (only used with action=save_file)",
      },
      format: {
        type: "string",
        enum: ["png", "jpeg", "webp", "svg", "pdf"],
        description: "Output format for save_file action (default: png)",
      },
      width: {
        type: "number",
        description: "Width in pixels (for image/SVG)",
      },
      height: {
        type: "number",
        description: "Height in pixels (for image/SVG)",
      },
      scale: {
        type: "number",
        description: "Scale factor (for image/SVG)",
      },
      bgColor: {
        type: "string",
        description:
          "Background color (e.g., 'white', '#FFFFFF') for image/SVG",
      },
      theme: {
        type: "string",
        enum: ["default", "neutral", "dark", "forest"],
        description: "Mermaid theme (for image/SVG)",
      },
      fit: {
        type: "boolean",
        description: "Fit diagram to page size (for PDF)",
      },
      paper: {
        type: "string",
        enum: ["a3", "a4", "a5"],
        description: "Paper size (for PDF)",
      },
      landscape: {
        type: "boolean",
        description: "Use landscape orientation (for PDF)",
      },
    },
    required: ["action", "diagram"],
  },
};

export function validateDiagram(diagram: string): void {
  if (!diagram || typeof diagram !== "string" || diagram.trim().length === 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Diagram must be a non-empty string"
    );
  }
}

export function validateFormat(format: string): void {
  const validFormats = ["png", "jpeg", "webp", "svg", "pdf"];
  if (!validFormats.includes(format)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid format: ${format}. Valid formats are: ${validFormats.join(", ")}`
    );
  }
}

// Unified encoding for both Mermaid Ink and Mermaid Live - services handle pako compression
function encodeMermaidDiagram(diagram: string): string {
  return Buffer.from(diagram, "utf8").toString("base64url");
}

function buildImageUrl(
  diagram: string,
  options: {
    type?: "jpeg" | "png" | "webp";
    width?: number;
    height?: number;
    scale?: number;
    bgColor?: string;
    theme?: "default" | "neutral" | "dark" | "forest";
  } = {}
): string {
  const encoded = encodeMermaidDiagram(diagram);
  const baseUrl = MermaidUrls.image(encoded);

  const params = new URLSearchParams();
  if (options.type && options.type !== "jpeg") {
    params.append("type", options.type);
  }
  if (options.width) params.append("width", options.width.toString());
  if (options.height) params.append("height", options.height.toString());
  if (options.scale) params.append("scale", options.scale.toString());
  if (options.bgColor) params.append("bgColor", options.bgColor);
  if (options.theme) params.append("theme", options.theme);

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

function buildSvgUrl(
  diagram: string,
  options: {
    bgColor?: string;
    theme?: "default" | "neutral" | "dark" | "forest";
    width?: number;
    height?: number;
    scale?: number;
  } = {}
): string {
  const encoded = encodeMermaidDiagram(diagram);
  const baseUrl = MermaidUrls.svg(encoded);

  const params = new URLSearchParams();
  if (options.bgColor) params.append("bgColor", options.bgColor);
  if (options.theme) params.append("theme", options.theme);
  if (options.width) params.append("width", options.width.toString());
  if (options.height) params.append("height", options.height.toString());
  if (options.scale) params.append("scale", options.scale.toString());

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

function buildPdfUrl(
  diagram: string,
  options: {
    fit?: boolean;
    paper?: "a3" | "a4" | "a5";
    landscape?: boolean;
  } = {}
): string {
  const encoded = encodeMermaidDiagram(diagram);
  const baseUrl = MermaidUrls.pdf(encoded);

  const params = new URLSearchParams();
  if (options.fit) params.append("fit", "true");
  if (options.paper) params.append("paper", options.paper);
  if (options.landscape) params.append("landscape", "true");

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

function generateMermaidUrls(
  diagram: string,
  args: any
): {
  editUrl: string;
  viewUrl: string;
} {
  const encoded = encodeMermaidDiagram(diagram);

  return {
    editUrl: MermaidUrls.edit(encoded),
    viewUrl: MermaidUrls.view(encoded),
  };
}

async function fetchMermaidContent(
  url: string,
  format: string = "png"
): Promise<any> {
  const responseType = format === "svg" ? "text" : "arraybuffer";

  try {
    const response = await axios.get(url, {
      responseType: responseType as any,
      timeout: 30000,
      headers: {
        Accept: format === "svg" ? "image/svg+xml" : "image/*",
      },
    });

    return response.data;
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to fetch diagram content: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function handleCreateMermaidDiagram(args: any): Promise<any> {
  const diagram = args.diagram as string;
  if (!diagram) {
    throw new McpError(ErrorCode.InvalidParams, "Missing diagram code");
  }

  validateDiagram(diagram);

  const action = args.action as string;
  if (action !== "get_url" && action !== "save_file") {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid action: ${action}. Use 'get_url' or 'save_file'`
    );
  }

  const { editUrl, viewUrl } = generateMermaidUrls(diagram, args);

  // Get PNG image for base64 encoding
  const pngUrl = buildImageUrl(diagram, {
    type: "png",
    width: args.width,
    height: args.height,
    scale: args.scale,
    bgColor: args.bgColor,
    theme: args.theme,
  });

  const pngData = await fetchMermaidContent(pngUrl, "png");
  const pngBase64 = Buffer.from(pngData).toString("base64");

  const result: any = {
    content: [
      {
        type: "text",
        text: "Below is the Mermaid Live Editor URL:",
      },
      {
        type: "text",
        text: editUrl,
      },
      {
        type: "text",
        text: "Below is the view-only URL:",
      },
      {
        type: "text",
        text: viewUrl,
      },
      {
        type: "text",
        text: "Below is the PNG image:",
      },
      {
        type: "image",
        data: pngBase64,
        mimeType: "image/png",
      },
    ],
    metadata: {
      diagramType: "mermaid",
      generatedAt: new Date().toISOString(),
      viewUrl: viewUrl,
      editUrl: editUrl,
      pngBase64: pngBase64,
    },
  };

  if (action === "get_url") {
    return result;
  }

  const format = (args.format as string) || "png";
  validateFormat(format);

  const outputPath = getDownloadPath(
    args.outputPath as string | undefined,
    format
  );

  try {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let data: any;
    let url: string;

    switch (format) {
      case "png":
      case "jpeg":
      case "webp":
        url = buildImageUrl(diagram, {
          type: format as "jpeg" | "png" | "webp",
          width: args.width,
          height: args.height,
          scale: args.scale,
          bgColor: args.bgColor,
          theme: args.theme,
        });
        data = await fetchMermaidContent(url, format);
        fs.writeFileSync(outputPath, data);
        break;

      case "svg":
        url = buildSvgUrl(diagram, {
          bgColor: args.bgColor,
          theme: args.theme,
          width: args.width,
          height: args.height,
          scale: args.scale,
        });
        data = await fetchMermaidContent(url, "svg");
        fs.writeFileSync(outputPath, data, "utf8");
        break;

      case "pdf":
        url = buildPdfUrl(diagram, {
          fit: args.fit,
          paper: args.paper,
          landscape: args.landscape,
        });
        data = await fetchMermaidContent(url, "pdf");
        fs.writeFileSync(outputPath, data);
        break;

      default:
        throw new McpError(
          ErrorCode.InvalidParams,
          `Unsupported format: ${format}`
        );
    }

    result.metadata.savedPath = outputPath;
    result.content.push({
      type: "text",
      text: "Below is the saved file path:",
    });
    result.content.push({
      type: "text",
      text: outputPath,
    });
    return result;
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to save diagram: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
