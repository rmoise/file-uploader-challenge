import React from "react";
import {
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  Divider,
} from "@shopify/polaris";
import { PlayIcon, XIcon, DeleteIcon } from "@shopify/polaris-icons";
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
    clearCompleted,
    startProcessing,
    stopProcessing,
  } = queue;

  if (files.length === 0) {
    return (
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h3">
            Upload Queue
          </Text>
          <Text tone="subdued" as="p">
            No files in queue. Drag and drop files above to get started.
          </Text>
        </BlockStack>
      </Card>
    );
  }

  return (
    <Card>
      <BlockStack gap="400">
        {/* Header with Statistics */}
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h3">
              Upload Queue ({stats.total} files)
            </Text>

            <InlineStack gap="200">
              {stats.pending > 0 && (
                <Badge tone="info">{`${stats.pending} Pending`}</Badge>
              )}
              {stats.uploading > 0 && (
                <Badge tone="attention">{`${stats.uploading} Uploading`}</Badge>
              )}
              {stats.completed > 0 && (
                <Badge tone="success">{`${stats.completed} Completed`}</Badge>
              )}
              {stats.failed > 0 && (
                <Badge tone="critical">{`${stats.failed} Failed`}</Badge>
              )}
            </InlineStack>
          </InlineStack>

          {/* Queue Controls */}
          <InlineStack gap="200">
            {!isProcessing ? (
              <Button
                variant="primary"
                onClick={startProcessing}
                disabled={stats.pending === 0}
                icon={PlayIcon}
              >
                Start Upload
              </Button>
            ) : (
              <Button onClick={stopProcessing} icon={XIcon}>
                Stop Upload
              </Button>
            )}

            {(stats.completed > 0 || stats.failed > 0) && (
              <Button
                variant="plain"
                onClick={clearCompleted}
                icon={DeleteIcon}
              >
                Clear Completed
              </Button>
            )}
          </InlineStack>

          {/* Processing Status */}
          {isProcessing && stats.uploading > 0 && (
            <Text tone="subdued" as="p">
              Uploading {stats.uploading} of max 2 concurrent files...
            </Text>
          )}
        </BlockStack>

        <Divider />

        {/* File List */}
        <BlockStack gap="300">
          {files.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              onRetry={retryFile}
              onRemove={removeFile}
            />
          ))}
        </BlockStack>

        {/* Summary Footer */}
        {stats.total > 5 && (
          <>
            <Divider />
            <InlineStack align="space-between">
              <Text variant="bodySm" tone="subdued" as="p">
                Total: {stats.total} files
              </Text>
              <Text variant="bodySm" tone="subdued" as="p">
                Success Rate:{" "}
                {stats.total > 0
                  ? Math.round(
                      (stats.completed / (stats.completed + stats.failed)) * 100
                    ) || 0
                  : 0}
                %
              </Text>
            </InlineStack>
          </>
        )}
      </BlockStack>
    </Card>
  );
};
