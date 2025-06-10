import { useState, useCallback, useRef, useEffect } from "react";
import type { FileUploadItem } from "../types/upload";

// Simple UUID generator to avoid external dependency
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};
import { uploadService } from "../services/uploadService";
import {
  MAX_CONCURRENT_UPLOADS,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAY_MS,
} from "../constants";

export interface UseUploadQueueOptions {
  maxConcurrent?: number;
  maxRetries?: number;
  retryDelay?: number;
  autoStart?: boolean;
}

export interface UseUploadQueueReturn {
  // State
  files: FileUploadItem[];
  uploading: Set<string>;
  isProcessing: boolean;

  // Actions
  addFiles: (files: File[]) => void;
  retryFile: (fileId: string) => void;
  removeFile: (fileId: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  startProcessing: () => void;
  stopProcessing: () => void;

  // Stats
  stats: {
    total: number;
    pending: number;
    uploading: number;
    completed: number;
    failed: number;
  };
}

export const useUploadQueue = (
  options: UseUploadQueueOptions = {}
): UseUploadQueueReturn => {
  const {
    maxConcurrent = MAX_CONCURRENT_UPLOADS,
    maxRetries = MAX_RETRY_ATTEMPTS,
    retryDelay = RETRY_DELAY_MS,
    autoStart = true,
  } = options;

  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [uploading, setUploading] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Use refs to avoid stale closures - Following Context7 pattern
  const filesRef = useRef<FileUploadItem[]>([]);
  const uploadingRef = useRef<Set<string>>(new Set());
  const processingRef = useRef(false);
  const retryTimeoutsRef = useRef<Map<string, number>>(new Map());
  const processingTimeoutRef = useRef<number | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    uploadingRef.current = uploading;
  }, [uploading]);

  // Add files to the queue
  const addFiles = useCallback(
    (newFiles: File[]) => {
      const fileItems: FileUploadItem[] = newFiles.map((file) => ({
        id: generateId(),
        file,
        status: "pending",
        progress: 0,
        retryCount: 0,
        uploadStartTime: undefined,
        uploadEndTime: undefined,
      }));

      setFiles((prev) => [...prev, ...fileItems]);

      // Auto-start processing if enabled
      if (autoStart && !processingRef.current) {
        setIsProcessing(true);
      }
    },
    [autoStart]
  );

  // Retry a failed file
  const retryFile = useCallback((fileId: string) => {
    setFiles((prev) =>
      prev.map((file) =>
        file.id === fileId
          ? { ...file, status: "pending", progress: 0, error: undefined }
          : file
      )
    );

    // Start processing if not already running
    if (!processingRef.current) {
      setIsProcessing(true);
    }
  }, []);

  // Remove a file from the queue
  const removeFile = useCallback(
    async (fileId: string) => {
      // Find the file to get its S3 key
      const file = files.find((f) => f.id === fileId);

      // Cancel upload if in progress
      uploadService.cancelUpload(fileId);

      // Clear any retry timeout
      const timeout = retryTimeoutsRef.current.get(fileId);
      if (timeout) {
        clearTimeout(timeout);
        retryTimeoutsRef.current.delete(fileId);
      }

      // If file was completed and has S3 key, delete from S3
      if (file?.s3Key && file.status === "completed") {
        try {
          await uploadService.deleteFile(file.s3Key);
        } catch (error) {
          console.error("Failed to delete file from S3:", error);
          // Don't remove from UI if S3 delete fails - show error instead
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? { ...f, error: "Failed to delete from storage" }
                : f
            )
          );
          return; // Exit early, don't remove from UI
        }
      } else {
        console.log("Skipping S3 delete - file not completed or no S3 key");
      }

      // Only remove from state if S3 delete was successful (or file wasn't uploaded)
      setFiles((prev) => prev.filter((file) => file.id !== fileId));
      setUploading((prev) => {
        const newUploading = new Set(prev);
        newUploading.delete(fileId);
        return newUploading;
      });
    },
    [files]
  );

  // Clear completed files
  const clearCompleted = useCallback(async () => {
    // Get completed files that have S3 keys
    const completedFiles = files.filter(
      (file) => file.status === "completed" && file.s3Key
    );

    const successfullyDeletedIds: string[] = [];
    const failedDeleteIds: string[] = [];

    // Delete completed files from S3
    for (const file of completedFiles) {
      if (file.s3Key) {
        try {
          await uploadService.deleteFile(file.s3Key);
          console.log("Completed file deleted from S3:", file.file.name);
          successfullyDeletedIds.push(file.id);
        } catch (error) {
          console.error("Failed to delete completed file from S3:", error);
          failedDeleteIds.push(file.id);
        }
      }
    }

    // Mark failed deletes with error
    if (failedDeleteIds.length > 0) {
      setFiles((prev) =>
        prev.map((file) =>
          failedDeleteIds.includes(file.id)
            ? { ...file, error: "Failed to delete from storage" }
            : file
        )
      );
    }

    // Only remove successfully deleted files and failed uploads from state
    setFiles((prev) =>
      prev.filter(
        (file) =>
          // Keep files that failed to delete from S3
          (file.status === "completed" && failedDeleteIds.includes(file.id)) ||
          // Keep pending and uploading files
          (file.status !== "completed" && file.status !== "failed")
      )
    );
  }, [files]);

  // Start processing the queue
  const startProcessing = useCallback(() => {
    setIsProcessing(true);
  }, []);

  // Stop processing the queue
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    processingRef.current = false;
    uploadService.cancelAllUploads();

    // Clear processing timeout
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = null;
    }

    // Clear all retry timeouts
    retryTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    retryTimeoutsRef.current.clear();

    setUploading(new Set());
  }, []);

  // Upload a single file - Use function references to avoid stale closures
  const uploadFile = useCallback(
    async (fileId: string) => {
      // Use refs to get current state - Following Context7 pattern for avoiding stale closures
      const currentFiles = filesRef.current;
      const file = currentFiles.find((f) => f.id === fileId);

      if (!file) return;

      // Mark as uploading
      setUploading((prev) => new Set([...prev, file.id]));
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? { ...f, status: "uploading", uploadStartTime: Date.now() }
            : f
        )
      );

      try {
        // Use uploadWithRetry for automatic retry logic with exponential backoff
        const result = await uploadService.uploadWithRetry(
          file.id,
          file.file,
          {
            onProgress: (progress) => {
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === file.id ? { ...f, progress: progress.progress } : f
                )
              );
            },
          },
          maxRetries
        );

        // Remove from uploading set
        setUploading((prev) => {
          const newUploading = new Set(prev);
          newUploading.delete(file.id);
          return newUploading;
        });

        // Mark as completed - Backend handles retries automatically
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: "completed",
                  progress: 100,
                  uploadEndTime: Date.now(),
                  error: undefined,
                  s3Key: result.data?.data?.s3Key, // Fixed: access nested data
                  fileUrl: result.data?.data?.fileUrl, // Fixed: access nested data
                }
              : f
          )
        );
      } catch (error) {
        // Remove from uploading set
        setUploading((prev) => {
          const newUploading = new Set(prev);
          newUploading.delete(file.id);
          return newUploading;
        });

        // uploadWithRetry already handled all retries, so this is a final failure
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";

        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: "failed",
                  uploadEndTime: Date.now(),
                  error: errorMessage,
                  retryCount: maxRetries, // Mark as max retries reached
                }
              : f
          )
        );
      }
    },
    [maxRetries]
  );

  // Process the upload queue - Stable function without state dependencies
  const processQueue = useCallback(async () => {
    if (!isProcessing || processingRef.current) return;

    processingRef.current = true;

    const processLoop = async () => {
      // Use refs to get current state - Following Context7 pattern
      const currentFiles = filesRef.current;
      const currentUploading = uploadingRef.current;

      // Get pending files
      const pendingFiles = currentFiles.filter(
        (file) => file.status === "pending"
      );

      // Calculate how many more uploads we can start
      const availableSlots = maxConcurrent - currentUploading.size;

      if (availableSlots > 0 && pendingFiles.length > 0) {
        // Start uploads for available slots
        const filesToUpload = pendingFiles.slice(0, availableSlots);

        for (const file of filesToUpload) {
          uploadFile(file.id);
        }
      }

      // Check if we should continue processing
      if (processingRef.current && isProcessing) {
        const hasWork = pendingFiles.length > 0 || currentUploading.size > 0;

        if (hasWork) {
          // Schedule next check
          processingTimeoutRef.current = setTimeout(processLoop, 100);
        } else {
          // All done
          processingRef.current = false;
          setIsProcessing(false);
        }
      }
    };

    processLoop();
  }, [isProcessing, maxConcurrent, uploadFile]);

  // Start queue processing when isProcessing changes
  useEffect(() => {
    if (isProcessing && !processingRef.current) {
      processQueue();
    }
  }, [isProcessing, processQueue]);

  // Calculate stats
  const stats = {
    total: files.length,
    pending: files.filter((f) => f.status === "pending").length,
    uploading: files.filter((f) => f.status === "uploading").length,
    completed: files.filter((f) => f.status === "completed").length,
    failed: files.filter((f) => f.status === "failed").length,
  };

  // Cleanup on unmount - Following Context7 cleanup pattern
  useEffect(() => {
    return () => {
      processingRef.current = false;
      uploadService.cancelAllUploads();

      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
      }

      retryTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      retryTimeoutsRef.current.clear();
    };
  }, []);

  return {
    files,
    uploading,
    isProcessing,
    addFiles,
    retryFile,
    removeFile,
    clearCompleted,
    startProcessing,
    stopProcessing,
    stats,
  };
};
