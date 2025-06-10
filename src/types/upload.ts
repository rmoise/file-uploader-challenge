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
  s3Key?: string; // Store S3 key for deletion
  fileUrl?: string; // Store file URL after upload
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

// Backend response data structure from Context7 API
export interface UploadResponseData {
  fileId: string;
  fileName: string;
  fileUrl: string;
  s3Key?: string;
  fileSize: number;
  bucket?: string;
  etag?: string;
  uploadedAt: string;
  contentType?: string;
  processingTime?: number;
  validations?: {
    basic: boolean;
    extension: boolean;
    content: boolean;
  };
  metadata?: Record<string, any>;
}

// Backend response meta information
export interface UploadResponseMeta {
  requestId: string;
  timestamp: string;
  processingTime?: number;
}

// Complete upload result following Context7 patterns
export interface UploadResult {
  success: boolean;
  fileId: string;
  error?: string;
  data?: {
    success: boolean;
    data: UploadResponseData;
    meta?: UploadResponseMeta;
  };
  meta?: UploadResponseMeta;
}
