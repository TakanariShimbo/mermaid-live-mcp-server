import { Tool, McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { deflate } from "pako";
import { getDownloadPath } from "../utils/file.js";
import { MermaidUrls } from "../utils/config.js";
import { fromUint8Array } from "js-base64";

/**
 * Tool description
 */
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

/**
 * Validates
 */
function validateDiagram(diagram: string): void {
  if (!diagram || typeof diagram !== "string" || diagram.trim().length === 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Diagram must be a non-empty string"
    );
  }
}

function validateFormat(format: string): void {
  const validFormats = ["png", "jpeg", "webp", "svg", "pdf"];
  if (!validFormats.includes(format)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid format: ${format}. Valid formats are: ${validFormats.join(", ")}`
    );
  }
}

function validateAction(action: string): void {
  if (!action || typeof action !== "string" || action.trim().length === 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Action must be a non-empty string"
    );
  }
  const validActions = ["get_url", "save_file"];
  if (!validActions.includes(action)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid action: ${action}. Valid actions are: ${validActions.join(", ")}`
    );
  }
}

function validateOutputPath(
  outputPath: string | undefined,
  action: string
): void {
  if (
    action === "save_file" &&
    (!outputPath ||
      typeof outputPath !== "string" ||
      outputPath.trim().length === 0)
  ) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Output path is required for save_file action"
    );
  }
}

function validateDimensions(width?: number, height?: number): void {
  if (width !== undefined) {
    if (!Number.isInteger(width) || width <= 0 || width > 10000) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Width must be a positive integer between 1 and 10000"
      );
    }
  }
  if (height !== undefined) {
    if (!Number.isInteger(height) || height <= 0 || height > 10000) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Height must be a positive integer between 1 and 10000"
      );
    }
  }
}

function validateScale(scale?: number): void {
  if (scale !== undefined) {
    if (typeof scale !== "number" || scale <= 0 || scale > 10) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Scale must be a positive number between 0 and 10"
      );
    }
  }
}

function validateBgColor(bgColor?: string): void {
  if (bgColor !== undefined) {
    if (typeof bgColor !== "string" || bgColor.trim().length === 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Background color must be a non-empty string"
      );
    }
    const colorPattern =
      /^(#[0-9A-Fa-f]{3,8}|[a-zA-Z]+|rgb\(.*\)|rgba\(.*\)|hsl\(.*\)|hsla\(.*\))$/;
    if (!colorPattern.test(bgColor.trim())) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Background color must be a valid CSS color (e.g., 'white', '#FFFFFF', 'rgb(255,255,255)')"
      );
    }
  }
}

function validatePdfOptions(
  fit?: boolean,
  paper?: string,
  landscape?: boolean
): void {
  if (fit !== undefined && typeof fit !== "boolean") {
    throw new McpError(ErrorCode.InvalidParams, "Fit option must be a boolean");
  }
  if (paper !== undefined) {
    const validPapers = ["a3", "a4", "a5"];
    if (!validPapers.includes(paper)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid paper size: ${paper}. Valid sizes are: ${validPapers.join(
          ", "
        )}`
      );
    }
  }
  if (landscape !== undefined && typeof landscape !== "boolean") {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Landscape option must be a boolean"
    );
  }
}

function encodeMermaidDiagram(diagram: string): string {
  const json = JSON.stringify({ code: diagram });
  const bytes = new TextEncoder().encode(json);
  const zlib = deflate(bytes, { level: 9 });
  return fromUint8Array(zlib, true);
}

function buildMermaidUrl(
  diagram: string,
  type: "edit" | "view" | "png" | "jpeg" | "webp" | "svg" | "pdf",
  options: {
    width?: number;
    height?: number;
    scale?: number;
    bgColor?: string;
    fit?: boolean;
    paper?: "a3" | "a4" | "a5";
    landscape?: boolean;
  } = {}
): string {
  const encoded = encodeMermaidDiagram(diagram);

  let baseUrl: string;
  switch (type) {
    case "edit":
      return MermaidUrls.edit(encoded);
    case "view":
      return MermaidUrls.view(encoded);
    case "png":
    case "jpeg":
    case "webp":
      baseUrl = MermaidUrls.image(encoded);
      break;
    case "svg":
      baseUrl = MermaidUrls.svg(encoded);
      break;
    case "pdf":
      baseUrl = MermaidUrls.pdf(encoded);
      break;
    default:
      throw new Error(`Unsupported type: ${type}`);
  }

  const params = new URLSearchParams();

  if (type === "png" || type === "jpeg" || type === "webp") {
    if (type !== "jpeg") {
      params.append("type", type);
    }
    if (options?.width) params.append("width", options.width.toString());
    if (options?.height) params.append("height", options.height.toString());
    if (options?.scale) params.append("scale", options.scale.toString());
    if (options?.bgColor) params.append("bgColor", options.bgColor);
  } else if (type === "svg") {
    if (options?.bgColor) params.append("bgColor", options.bgColor);
    if (options?.width) params.append("width", options.width.toString());
    if (options?.height) params.append("height", options.height.toString());
    if (options?.scale) params.append("scale", options.scale.toString());
  } else if (type === "pdf") {
    if (options?.fit) params.append("fit", "true");
    if (options?.paper) params.append("paper", options.paper);
    if (options?.landscape) params.append("landscape", "true");
  }

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
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
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept: format === "svg" ? "image/svg+xml,*/*" : "image/*,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      validateStatus: function (status) {
        return status >= 200 && status < 300;
      },
    });

    return response.data;
  } catch (error) {
    const axiosError = error as any;
    const message = axiosError.response
      ? `Failed to fetch diagram content from ${url} - Status: ${axiosError.response.status}`
      : `Failed to fetch diagram content from ${url} - ${axiosError.message}`;

    throw new McpError(ErrorCode.InternalError, message);
  }
}

export async function handleCreateMermaidDiagram(args: any): Promise<any> {
  const diagram = args.diagram as string;
  const action = args.action as string;
  validateDiagram(diagram);
  validateAction(action);
  validateOutputPath(args.outputPath, action);
  validateDimensions(args.width, args.height);
  validateScale(args.scale);
  validateBgColor(args.bgColor);
  validatePdfOptions(args.fit, args.paper, args.landscape);

  const editUrl = buildMermaidUrl(diagram, "edit");
  const viewUrl = buildMermaidUrl(diagram, "view");

  // Get PNG image for base64 encoding
  const pngUrl = buildMermaidUrl(diagram, "png", {
    width: args.width,
    height: args.height,
    scale: args.scale,
    bgColor: args.bgColor,
  });

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
    ],
    metadata: {
      diagramType: "mermaid",
      generatedAt: new Date().toISOString(),
      viewUrl: viewUrl,
      editUrl: editUrl,
    },
  };

  try {
    const pngData = await fetchMermaidContent(pngUrl, "png");
    const pngBase64 = Buffer.from(pngData).toString("base64");

    result.content.push(
      {
        type: "text",
        text: "Below is the PNG image:",
      },
      {
        type: "image",
        data: pngBase64,
        mimeType: "image/png",
      }
    );
    result.metadata.pngBase64 = pngBase64;
  } catch (error) {
    result.content.unshift({
      type: "text",
      text: "⚠️ Failed to fetch diagram image",
    });
    result.content.push({
      type: "text",
      text: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
    result.metadata.error =
      error instanceof Error ? error.message : String(error);
  }

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

    const url = buildMermaidUrl(
      diagram,
      format as "png" | "jpeg" | "webp" | "svg" | "pdf",
      {
        width: args.width,
        height: args.height,
        scale: args.scale,
        bgColor: args.bgColor,
        fit: args.fit,
        paper: args.paper,
        landscape: args.landscape,
      }
    );

    const data = await fetchMermaidContent(url, format);

    if (format === "svg") {
      fs.writeFileSync(outputPath, data, "utf8");
    } else {
      fs.writeFileSync(outputPath, data);
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
