// Upload Configuration
export const MAX_CONCURRENT_UPLOADS = 2;
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 1000;

// File Validation
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// UI Constants
export const UPLOAD_SIMULATION_SPEED = 200; // ms between progress updates
export const PROGRESS_STEP = 10; // percentage points per update

// Status Messages
export const STATUS_MESSAGES = {
  pending: "Waiting to upload...",
  uploading: "Uploading...",
  completed: "Upload complete",
  failed: "Upload failed",
} as const;

// File Size Formatting
export const formatFileSize = (bytes: number): string => {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
};
