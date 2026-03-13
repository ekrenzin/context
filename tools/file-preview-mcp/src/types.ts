export interface PreviewEntry {
  id: string;
  path: string;
  filename: string;
  type: FileType;
  title: string;
  url: string;
  timestamp: string;
}

export type FileType =
  | "image"
  | "pdf"
  | "html"
  | "svg"
  | "csv"
  | "json"
  | "markdown";

export const SUPPORTED_EXTENSIONS: Record<string, FileType> = {
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".webp": "image",
  ".svg": "svg",
  ".pdf": "pdf",
  ".html": "html",
  ".htm": "html",
  ".csv": "csv",
  ".json": "json",
  ".md": "markdown",
};

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
