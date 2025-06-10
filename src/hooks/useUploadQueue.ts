import { useState, useCallback, useRef, useEffect } from "react";
import type { FileUploadItem, UploadQueueState } from "../types/upload";

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
  removeFile: (fileId: string) => void;
  clearCompleted: () => void;
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

  const processingRef = useRef(false);
  const retryTimeoutsRef = useRef<Map<string, number>>(new Map());

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
  const removeFile = useCallback((fileId: string) => {
    // Cancel upload if in progress
    uploadService.cancelUpload(fileId);

    // Clear any retry timeout
    const timeout = retryTimeoutsRef.current.get(fileId);
    if (timeout) {
      clearTimeout(timeout);
      retryTimeoutsRef.current.delete(fileId);
    }

    // Remove from state
    setFiles((prev) => prev.filter((file) => file.id !== fileId));
    setUploading((prev) => {
      const newUploading = new Set(prev);
      newUploading.delete(fileId);
      return newUploading;
    });
  }, []);

  // Clear completed files
  const clearCompleted = useCallback(() => {
    setFiles((prev) =>
      prev.filter(
        (file) => file.status !== "completed" && file.status !== "failed"
      )
    );
  }, []);

  // Start processing the queue
  const startProcessing = useCallback(() => {
    setIsProcessing(true);
  }, []);

  // Stop processing the queue
  const stopProcessing = useCallback(() => {
    setIsProcessing(false);
    processingRef.current = false;
    uploadService.cancelAllUploads();

    // Clear all retry timeouts
    retryTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    retryTimeoutsRef.current.clear();

    setUploading(new Set());
  }, []);

  // Process the upload queue
  const processQueue = useCallback(async () => {
    if (!isProcessing || processingRef.current) return;

    processingRef.current = true;

    while (processingRef.current && isProcessing) {
      // Get pending files
      const pendingFiles = files.filter((file) => file.status === "pending");

      // Get currently uploading count
      const currentlyUploading = uploading.size;

      // Calculate how many more uploads we can start
      const availableSlots = maxConcurrent - currentlyUploading;

      if (availableSlots <= 0 || pendingFiles.length === 0) {
        // No slots available or no pending files
        if (currentlyUploading === 0 && pendingFiles.length === 0) {
          // All done
          break;
        }
        // Wait a bit before checking again
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      // Start uploads for available slots
      const filesToUpload = pendingFiles.slice(0, availableSlots);

      for (const file of filesToUpload) {
        uploadFile(file);
      }

      // Wait a bit before next iteration
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    processingRef.current = false;
    setIsProcessing(false);
  }, [files, uploading, isProcessing, maxConcurrent]);

  // Upload a single file
  const uploadFile = useCallback(
    async (file: FileUploadItem) => {
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
        const result = await uploadService.uploadFile(file.id, file.file, {
          onProgress: (progress) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === file.id ? { ...f, progress: progress.progress } : f
              )
            );
          },
        });

        // Remove from uploading set
        setUploading((prev) => {
          const newUploading = new Set(prev);
          newUploading.delete(file.id);
          return newUploading;
        });

        if (result.success) {
          // Mark as completed
          setFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? {
                    ...f,
                    status: "completed",
                    progress: 100,
                    uploadEndTime: Date.now(),
                    error: undefined,
                  }
                : f
            )
          );
        } else {
          // Handle failure
          const updatedFile = files.find((f) => f.id === file.id);
          const retryCount = (updatedFile?.retryCount || 0) + 1;

          if (retryCount < maxRetries) {
            // Schedule retry
            setFiles((prev) =>
              prev.map((f) =>
                f.id === file.id
                  ? {
                      ...f,
                      status: "pending",
                      progress: 0,
                      retryCount,
                      error: result.error,
                    }
                  : f
              )
            );

            // Schedule retry after delay
            const timeout = setTimeout(() => {
              retryTimeoutsRef.current.delete(file.id);
              // Retry will be picked up by the queue processor
            }, retryDelay);

            retryTimeoutsRef.current.set(file.id, timeout);
          } else {
            // Max retries reached
            setFiles((prev) =>
              prev.map((f) =>
                f.id === file.id
                  ? {
                      ...f,
                      status: "failed",
                      uploadEndTime: Date.now(),
                      error: result.error,
                    }
                  : f
              )
            );
          }
        }
      } catch (error) {
        // Remove from uploading set
        setUploading((prev) => {
          const newUploading = new Set(prev);
          newUploading.delete(file.id);
          return newUploading;
        });

        // Mark as failed
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: "failed",
                  uploadEndTime: Date.now(),
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                }
              : f
          )
        );
      }
    },
    [files, maxRetries, retryDelay]
  );

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      uploadService.cancelAllUploads();
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
