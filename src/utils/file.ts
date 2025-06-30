import * as fs from "fs";
import * as path from "path";
import axios from 'axios';

/**
 * Get appropriate download path for files
 */
export function getDownloadPath(outputPath?: string, format: string = "png"): string {
  // Get the default directory from environment variable
  const defaultDirConfig = process.env.MERMAID_DEFAULT_OUTPUT_DIR;
  const desktopPath = path.join(
    process.env.HOME || process.env.USERPROFILE || ".",
    "Desktop"
  );
  let basePath: string;
  
  if (defaultDirConfig && path.isAbsolute(defaultDirConfig) && fs.existsSync(defaultDirConfig)) {
    // Use absolute path only if it exists
    basePath = defaultDirConfig;
  } else {
    // Fallback to Desktop in home directory for any invalid case
    basePath = desktopPath;
  }
  
  if (outputPath) {
    if (path.isAbsolute(outputPath)) {
      return outputPath;
    }
    
    if (fs.existsSync(basePath)) {
      return path.join(basePath, outputPath);
    }
    
    // Fallback to Desktop if configured path doesn't exist
    if (fs.existsSync(desktopPath)) {
      return path.join(desktopPath, outputPath);
    }
    
    // Final fallback to home directory
    return path.join(
      process.env.HOME || process.env.USERPROFILE || ".",
      outputPath
    );
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .split(".")[0];
  const filename = `mermaid_${timestamp}.${format}`;

  if (fs.existsSync(basePath)) {
    return path.join(basePath, filename);
  }

  // Fallback to Desktop if configured path doesn't exist
  if (fs.existsSync(desktopPath)) {
    return path.join(desktopPath, filename);
  }

  // Final fallback to home directory
  return path.join(
    process.env.HOME || process.env.USERPROFILE || ".",
    filename
  );
}

export async function saveFile(
  filePath: string, 
  content: Buffer | string
): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(filePath, content);
}

export async function downloadImage(url: string): Promise<Buffer> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'Accept': 'image/*'
      }
    });
    return Buffer.from(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to download image: ${error.message}`);
    }
    throw error;
  }
}