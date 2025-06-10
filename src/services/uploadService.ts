import { UPLOAD_SIMULATION_SPEED, PROGRESS_STEP } from "../constants";
import type { UploadProgress, UploadResult } from "../types/upload";

export interface UploadServiceOptions {
  onProgress?: (progress: UploadProgress) => void;
  simulateFailure?: boolean;
  failureRate?: number; // 0.0 to 1.0 (0% to 100%)
}

/**
 * Mock upload service that simulates file upload with progress updates
 * In a real implementation, this would upload to S3, Digital Ocean Spaces, etc.
 */
export class UploadService {
  private static instance: UploadService;
  private activeUploads = new Map<string, AbortController>();

  static getInstance(): UploadService {
    if (!UploadService.instance) {
      UploadService.instance = new UploadService();
    }
    return UploadService.instance;
  }

  /**
   * Upload a file with progress tracking
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
    const { onProgress, simulateFailure = false, failureRate = 0.2 } = options;

    // Create abort controller for cancellation
    const abortController = new AbortController();
    this.activeUploads.set(fileId, abortController);

    try {
      // Simulate upload progress
      let progress = 0;
      const totalSize = file.size;

      while (progress < 100) {
        // Check if upload was cancelled
        if (abortController.signal.aborted) {
          throw new Error("Upload cancelled");
        }

        // Wait for next progress update
        await this.delay(UPLOAD_SIMULATION_SPEED);

        // Increment progress
        progress = Math.min(progress + PROGRESS_STEP, 100);

        // Report progress
        if (onProgress) {
          onProgress({
            fileId,
            progress,
            loaded: Math.round((progress / 100) * totalSize),
            total: totalSize,
          });
        }
      }

      // Simulate potential failure
      const shouldFail = simulateFailure || Math.random() < failureRate;
      if (shouldFail) {
        throw new Error("Network error: Upload failed");
      }

      // Cleanup
      this.activeUploads.delete(fileId);

      return {
        success: true,
        fileId,
      };
    } catch (error) {
      this.activeUploads.delete(fileId);

      return {
        success: false,
        fileId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Cancel an ongoing upload
   * @param fileId File identifier to cancel
   */
  cancelUpload(fileId: string): void {
    const controller = this.activeUploads.get(fileId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(fileId);
    }
  }

  /**
   * Cancel all ongoing uploads
   */
  cancelAllUploads(): void {
    for (const [fileId, controller] of this.activeUploads) {
      controller.abort();
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
   * Utility function to create delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const uploadService = UploadService.getInstance();
