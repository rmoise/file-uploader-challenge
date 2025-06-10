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
          // Handle failure - Use current state via refs
          const currentFile = filesRef.current.find((f) => f.id === file.id);
          const retryCount = (currentFile?.retryCount || 0) + 1;

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
              // Queue will pick this up automatically
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
    [maxRetries, retryDelay]
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
