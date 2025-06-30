import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { saveFile, downloadImage } from "../utils/file.js";
import { resolve } from "path";
import { deflate } from "pako";

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

// Utility functions for Mermaid diagram encoding and URL generation
function encodeMermaidDiagram(diagram: string): string {
  const compressed = deflate(diagram, { level: 9 });
  return Buffer.from(compressed).toString("base64url");
}


function getMermaidLiveEditUrl(diagram: string): string {
  const compressed = encodeMermaidDiagram(diagram);
  return `https://mermaid.live/edit#pako:${compressed}`;
}

function getMermaidLiveViewUrl(diagram: string): string {
  const compressed = encodeMermaidDiagram(diagram);
  return `https://mermaid.live/view#pako:${compressed}`;
}

function getMermaidInkImageUrl(
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
  const compressed = encodeMermaidDiagram(diagram);
  const baseUrl = `https://mermaid.ink/img/${compressed}`;

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

function getMermaidInkSvgUrl(
  diagram: string,
  options: {
    bgColor?: string;
    theme?: "default" | "neutral" | "dark" | "forest";
    width?: number;
    height?: number;
    scale?: number;
  } = {}
): string {
  const compressed = encodeMermaidDiagram(diagram);
  const baseUrl = `https://mermaid.ink/svg/${compressed}`;

  const params = new URLSearchParams();
  if (options.bgColor) params.append("bgColor", options.bgColor);
  if (options.theme) params.append("theme", options.theme);
  if (options.width) params.append("width", options.width.toString());
  if (options.height) params.append("height", options.height.toString());
  if (options.scale) params.append("scale", options.scale.toString());

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

function getMermaidInkPdfUrl(
  diagram: string,
  options: {
    fit?: boolean;
    paper?: "a3" | "a4" | "a5";
    landscape?: boolean;
  } = {}
): string {
  const compressed = encodeMermaidDiagram(diagram);
  const baseUrl = `https://mermaid.ink/pdf/${compressed}`;

  const params = new URLSearchParams();
  if (options.fit) params.append("fit", "true");
  if (options.paper) params.append("paper", options.paper);
  if (options.landscape) params.append("landscape", "true");

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

export async function handleCreateMermaidDiagram(args: any): Promise<any> {
  const {
    action,
    diagram,
    outputPath,
    format = "png",
    width,
    height,
    scale,
    bgColor,
    theme,
    fit,
    paper,
    landscape,
  } = args;

  if (!diagram || typeof diagram !== "string") {
    throw new Error("Invalid diagram: must be a non-empty string");
  }

  if (action === "get_url") {
    // Return multiple URLs for different purposes
    const editUrl = getMermaidLiveEditUrl(diagram);
    const viewUrl = getMermaidLiveViewUrl(diagram);

    // Get image URLs for common formats
    const pngUrl = getMermaidInkImageUrl(diagram, {
      type: "png",
      width,
      height,
      scale,
      bgColor,
      theme,
    });


    // Download PNG for base64 encoding (following chart.ts pattern)
    const pngData = await downloadImage(pngUrl);
    const pngBase64 = pngData.toString("base64");

    return {
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
  }

  if (action === "save_file") {
    if (!outputPath) {
      throw new Error("outputPath is required when action is 'save_file'");
    }

    const resolvedPath = resolve(outputPath);

    try {
      switch (format) {
        case "png":
        case "jpeg":
        case "webp": {
          const imageUrl = getMermaidInkImageUrl(diagram, {
            type: format as "jpeg" | "png" | "webp",
            width,
            height,
            scale,
            bgColor,
            theme,
          });
          const imageBuffer = await downloadImage(imageUrl);
          await saveFile(resolvedPath, imageBuffer);
          break;
        }

        case "svg": {
          const svgUrl = getMermaidInkSvgUrl(diagram, {
            bgColor,
            theme,
            width,
            height,
            scale,
          });
          const response = await fetch(svgUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch SVG: ${response.statusText}`);
          }
          const svgContent = await response.text();
          await saveFile(resolvedPath, svgContent);
          break;
        }

        case "pdf": {
          const pdfUrl = getMermaidInkPdfUrl(diagram, {
            fit,
            paper,
            landscape,
          });
          const pdfBuffer = await downloadImage(pdfUrl);
          await saveFile(resolvedPath, pdfBuffer);
          break;
        }

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      return {
        content: [
          {
            type: "text",
            text: "Below is the saved file path:",
          },
          {
            type: "text",
            text: resolvedPath,
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Failed to save file: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  throw new Error(`Unknown action: ${action}`);
}
