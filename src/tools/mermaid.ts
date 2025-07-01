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

export function validateAction(action: string): void {
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

export function validateOutputPath(
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

export function validateDimensions(width?: number, height?: number): void {
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

export function validateScale(scale?: number): void {
  if (scale !== undefined) {
    if (typeof scale !== "number" || scale <= 0 || scale > 10) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Scale must be a positive number between 0 and 10"
      );
    }
  }
}

export function validateBgColor(bgColor?: string): void {
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

export function validatePdfOptions(
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

export function encodeMermaidDiagram(diagram: string): string {
  const json = JSON.stringify({ code: diagram });
  const bytes = new TextEncoder().encode(json);
  const zlib = deflate(bytes, { level: 9 });
  return fromUint8Array(zlib, true);
}

function buildFormatUrl(
  diagram: string,
  format: "png" | "jpeg" | "webp" | "svg" | "pdf",
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
  switch (format) {
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
      throw new Error(`Unsupported format: ${format}`);
  }

  const params = new URLSearchParams();
  
  if (format === "png" || format === "jpeg" || format === "webp") {
    if (format !== "jpeg") {
      params.append("type", format);
    }
    if (options?.width) params.append("width", options.width.toString());
    if (options?.height) params.append("height", options.height.toString());
    if (options?.scale) params.append("scale", options.scale.toString());
    if (options?.bgColor) params.append("bgColor", options.bgColor);
  } else if (format === "svg") {
    if (options?.bgColor) params.append("bgColor", options.bgColor);
    if (options?.width) params.append("width", options.width.toString());
    if (options?.height) params.append("height", options.height.toString());
    if (options?.scale) params.append("scale", options.scale.toString());
  } else if (format === "pdf") {
    if (options?.fit) params.append("fit", "true");
    if (options?.paper) params.append("paper", options.paper);
    if (options?.landscape) params.append("landscape", "true");
  }

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
    // Log more detailed error information
    const axiosError = error as any;
    let errorMessage = `Failed to fetch diagram content from ${url}`;

    if (axiosError.response) {
      errorMessage += ` - Status: ${axiosError.response.status}`;
      errorMessage += ` - StatusText: ${axiosError.response.statusText}`;
      if (axiosError.response.data) {
        const errorData = axiosError.response.data.toString
          ? axiosError.response.data.toString().substring(0, 200)
          : String(axiosError.response.data).substring(0, 200);
        errorMessage += ` - Response: ${errorData}`;
      }
    } else if (axiosError.request) {
      errorMessage += ` - Request failed: ${axiosError.message}`;
    } else {
      errorMessage += ` - Error: ${axiosError.message}`;
    }

    throw new McpError(ErrorCode.InternalError, errorMessage);
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

  const { editUrl, viewUrl } = generateMermaidUrls(diagram, args);

  // Get PNG image for base64 encoding
  const pngUrl = buildFormatUrl(diagram, "png", {
    width: args.width,
    height: args.height,
    scale: args.scale,
    bgColor: args.bgColor,
  });

  let pngData;
  let pngBase64 = "";

  try {
    pngData = await fetchMermaidContent(pngUrl, "png");
    pngBase64 = Buffer.from(pngData).toString("base64");
  } catch (error) {
    // Return URLs even if image fetch fails
    return {
      content: [
        {
          type: "text",
          text: "⚠️ Failed to fetch diagram image, but URLs were generated successfully:",
        },
        {
          type: "text",
          text: "Mermaid Live Editor URL:",
        },
        {
          type: "text",
          text: editUrl,
        },
        {
          type: "text",
          text: "View-only URL:",
        },
        {
          type: "text",
          text: viewUrl,
        },
        {
          type: "text",
          text: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      metadata: {
        diagramType: "mermaid",
        generatedAt: new Date().toISOString(),
        viewUrl: viewUrl,
        editUrl: editUrl,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }

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
        url = buildFormatUrl(diagram, format as "jpeg" | "png" | "webp", {
          width: args.width,
          height: args.height,
          scale: args.scale,
          bgColor: args.bgColor,
        });
        data = await fetchMermaidContent(url, format);
        fs.writeFileSync(outputPath, data);
        break;

      case "svg":
        url = buildFormatUrl(diagram, "svg", {
          bgColor: args.bgColor,
          width: args.width,
          height: args.height,
          scale: args.scale,
        });
        data = await fetchMermaidContent(url, "svg");
        fs.writeFileSync(outputPath, data, "utf8");
        break;

      case "pdf":
        url = buildFormatUrl(diagram, "pdf", {
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
