export type UploadStatus = "pending" | "uploading" | "completed" | "failed";

export interface FileUploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  retryCount: number;
  error?: string;
  uploadStartTime?: number;
  uploadEndTime?: number;
}

export interface UploadQueueState {
  files: FileUploadItem[];
  uploading: Set<string>;
  isProcessing: boolean;
}

export interface UploadOptions {
  maxConcurrent: number;
  maxRetries: number;
  retryDelay: number;
}

export interface UploadProgress {
  fileId: string;
  progress: number;
  loaded: number;
  total: number;
}

export interface UploadResult {
  success: boolean;
  fileId: string;
  error?: string;
}
