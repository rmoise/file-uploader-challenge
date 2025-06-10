import {
  API_BASE_URL,
  API_ENDPOINTS,
  UPLOAD_TIMEOUT,
  MAX_RETRY_ATTEMPTS,
} from "../constants";
import type { UploadProgress, UploadResult } from "../types/upload";

// Context7 frontend integration configuration
const RETRY_DELAYS = [1000, 2000, 4000]; // Progressive retry delays

export interface UploadServiceOptions {
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
  retryAttempt?: number;
}

/**
 * Production Upload Service following Context7 patterns
 * Uses XMLHttpRequest for progress tracking and integrates with Express backend
 */
export class UploadService {
  private static instance: UploadService;
  private activeUploads = new Map<string, XMLHttpRequest>();

  static getInstance(): UploadService {
    if (!UploadService.instance) {
      UploadService.instance = new UploadService();
    }
    return UploadService.instance;
  }

  /**
   * Upload a file with progress tracking - Context7 XMLHttpRequest pattern
   * @param fileId Unique identifier for the file
   * @param file File to upload
   * @param options Upload options including progress callback
   * @returns Promise that resolves with upload result
   */
  async uploadFile(
    fileId: string,
    file: File,
    options: UploadServiceOptions = {}
  ): Promise<UploadResult> {
    const { onProgress, signal, retryAttempt = 0 } = options;

    return new Promise<UploadResult>((resolve, reject) => {
      // Create FormData following Context7 patterns
      const formData = new FormData();
      formData.append("file", file);

      // Optional metadata for backend
      formData.append(
        "metadata",
        JSON.stringify({
          clientFileId: fileId,
          retryAttempt,
          timestamp: new Date().toISOString(),
          clientInfo: {
            userAgent: navigator.userAgent,
            language: navigator.language,
          },
        })
      );

      // Create XMLHttpRequest following Context7 patterns
      const xhr = new XMLHttpRequest();
      this.activeUploads.set(fileId, xhr);

      // Progress tracking - Context7 pattern
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress({
            fileId,
            progress,
            loaded: event.loaded,
            total: event.total,
          });
        }
      };

      // Success handler - Context7 pattern
      xhr.onload = () => {
        this.activeUploads.delete(fileId);

        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);

            // Validate response structure following Context7 patterns
            if (response.success && response.data) {
              resolve({
                success: true,
                fileId,
                data: response.data,
                meta: response.meta,
              });
            } else {
              const error = response.error || {
                message: "Unknown server error",
              };
              reject(
                this.createUploadError(
                  error.message,
                  error.retryable || false,
                  error.code
                )
              );
            }
          } catch (parseError) {
            reject(
              this.createUploadError(
                "Invalid response format from server",
                false,
                "PARSE_ERROR"
              )
            );
          }
        } else {
          // Handle HTTP error responses
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            const error = errorResponse.error || {};
            reject(
              this.createUploadError(
                error.message || `HTTP ${xhr.status}: ${xhr.statusText}`,
                error.retryable !== false, // Default to retryable unless explicitly false
                error.code || `HTTP_${xhr.status}`
              )
            );
          } catch (parseError) {
            reject(
              this.createUploadError(
                `HTTP ${xhr.status}: ${xhr.statusText}`,
                xhr.status >= 500, // Server errors are retryable
                `HTTP_${xhr.status}`
              )
            );
          }
        }
      };

      // Error handlers - Context7 patterns
      xhr.onerror = () => {
        this.activeUploads.delete(fileId);
        reject(
          this.createUploadError(
            "Network error - please check your connection",
            true,
            "NETWORK_ERROR"
          )
        );
      };

      xhr.ontimeout = () => {
        this.activeUploads.delete(fileId);
        reject(
          this.createUploadError(
            "Upload timeout - file may be too large",
            true,
            "TIMEOUT_ERROR"
          )
        );
      };

      // Handle abort signal
      if (signal) {
        signal.addEventListener("abort", () => {
          xhr.abort();
          this.activeUploads.delete(fileId);
          reject(
            this.createUploadError(
              "Upload cancelled by user",
              false,
              "USER_CANCELLED"
            )
          );
        });
      }

      // Configure and send request - Context7 patterns
      xhr.timeout = UPLOAD_TIMEOUT;
      xhr.open("POST", `${API_BASE_URL}${API_ENDPOINTS.upload}`);

      // Set headers for CORS and content handling
      xhr.setRequestHeader("Accept", "application/json");

      try {
        xhr.send(formData);
      } catch (sendError) {
        this.activeUploads.delete(fileId);
        reject(
          this.createUploadError(
            sendError instanceof Error
              ? sendError.message
              : "Failed to start upload",
            false,
            "SEND_ERROR"
          )
        );
      }
    });
  }

  /**
   * Upload with automatic retry logic - Context7 pattern
   * @param fileId Unique identifier for the file
   * @param file File to upload
   * @param options Upload options
   * @param maxRetries Maximum number of retry attempts
   * @returns Promise that resolves with upload result
   */
  async uploadWithRetry(
    fileId: string,
    file: File,
    options: UploadServiceOptions = {},
    maxRetries: number = MAX_RETRY_ATTEMPTS
  ): Promise<UploadResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.uploadFile(fileId, file, {
          ...options,
          retryAttempt: attempt,
        });

        // Success - return immediately
        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        const uploadError = error as UploadError;
        if (!uploadError.retryable || attempt === maxRetries) {
          break;
        }

        // Wait before retry with exponential backoff
        if (attempt < maxRetries) {
          const delay =
            RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw lastError;
  }

  /**
   * Cancel an ongoing upload
   * @param fileId File identifier to cancel
   */
  cancelUpload(fileId: string): void {
    const xhr = this.activeUploads.get(fileId);
    if (xhr) {
      xhr.abort();
      this.activeUploads.delete(fileId);
    }
  }

  /**
   * Cancel all ongoing uploads
   */
  cancelAllUploads(): void {
    for (const [fileId, xhr] of this.activeUploads) {
      xhr.abort();
    }
    this.activeUploads.clear();
  }

  /**
   * Get the number of active uploads
   */
  getActiveUploadCount(): number {
    return this.activeUploads.size;
  }

  /**
   * Check if a file is currently uploading
   */
  isUploading(fileId: string): boolean {
    return this.activeUploads.has(fileId);
  }

  /**
   * Delete a file from S3 storage
   * @param s3Key The S3 key of the file to delete
   * @returns Promise that resolves when file is deleted
   */
  async deleteFile(s3Key: string): Promise<void> {
    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.delete}/${s3Key}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error?.message ||
            `Delete failed with status ${response.status}`
        );
      }

      // Successfully deleted
      console.log("File deleted successfully from S3:", s3Key);
    } catch (error) {
      console.error("Delete file error:", error);
      throw this.createUploadError(
        error instanceof Error ? error.message : "Failed to delete file",
        false,
        "DELETE_ERROR"
      );
    }
  }

  /**
   * Get upload service health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    apiUrl: string;
    timestamp: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.health}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      return {
        healthy: response.ok,
        apiUrl: API_BASE_URL,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        apiUrl: API_BASE_URL,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Create standardized upload error - Context7 pattern
   */
  private createUploadError(
    message: string,
    retryable: boolean,
    code: string
  ): UploadError {
    const error = new Error(message) as UploadError;
    error.retryable = retryable;
    error.code = code;
    return error;
  }
}

// Custom error interface for upload errors
interface UploadError extends Error {
  retryable: boolean;
  code: string;
}

// Export singleton instance
export const uploadService = UploadService.getInstance();
