import React from "react";
import { Text, Button, BlockStack, InlineStack, Badge } from "@shopify/polaris";
import { PlayIcon, XIcon } from "@shopify/polaris-icons";
import { FileItem } from "./FileItem";
import type { UseUploadQueueReturn } from "../../hooks/useUploadQueue";

interface FileQueueProps {
  queue: UseUploadQueueReturn;
}

export const FileQueue: React.FC<FileQueueProps> = ({ queue }) => {
  const {
    files,
    isProcessing,
    stats,
    retryFile,
    removeFile,
    startProcessing,
    stopProcessing,
  } = queue;

  if (files.length === 0) {
    return null;
  }

  return (
    <BlockStack gap="400">
      {/* Clean Header */}
      <InlineStack align="space-between" blockAlign="center">
        <InlineStack gap="300" blockAlign="center">
          <Text variant="headingMd" as="h3">
            Files ({stats.total})
          </Text>

          {/* Status Badges - Only show active states */}
          <InlineStack gap="200">
            {stats.uploading > 0 && (
              <Badge tone="info">{`${stats.uploading} uploading`}</Badge>
            )}
            {stats.failed > 0 && (
              <Badge tone="critical">{`${stats.failed} failed`}</Badge>
            )}
          </InlineStack>
        </InlineStack>

        {/* Simple Control */}
        {!isProcessing ? (
          <Button
            variant="primary"
            onClick={startProcessing}
            disabled={stats.pending === 0}
            icon={PlayIcon}
            size="slim"
          >
            Upload
          </Button>
        ) : (
          <Button onClick={stopProcessing} icon={XIcon} size="slim">
            Stop
          </Button>
        )}
      </InlineStack>

      {/* Clean File List */}
      <BlockStack gap="200">
        {files.map((file) => (
          <FileItem
            key={file.id}
            file={file}
            onRetry={retryFile}
            onRemove={removeFile}
          />
        ))}
      </BlockStack>
    </BlockStack>
  );
};
