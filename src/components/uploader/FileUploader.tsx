import React from "react";
import {
  Page,
  BlockStack,
  Text,
  Card,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { FileDropZone } from "./FileDropZone";
import { FileQueue } from "./FileQueue";
import { useUploadQueue } from "../../hooks/useUploadQueue";

interface FileUploaderProps {
  title?: string;
  subtitle?: string;
  maxConcurrent?: number;
  maxRetries?: number;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  title = "File Uploader Challenge",
  subtitle = "React file uploader with queue management and retry logic",
  maxConcurrent = 2,
  maxRetries = 3,
}) => {
  const uploadQueue = useUploadQueue({
    maxConcurrent,
    maxRetries,
    autoStart: true,
  });

  const { stats, isProcessing } = uploadQueue;

  return (
    <Page title={title} subtitle={subtitle}>
      <BlockStack gap="600">
        {/* Status Overview */}
        {stats.total > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">
                Upload Status
              </Text>
              <InlineStack gap="300">
                <Text as="p">
                  <strong>Total Files:</strong> {stats.total}
                </Text>
                <Text as="p">
                  <strong>Max Concurrent:</strong> {maxConcurrent}
                </Text>
                {isProcessing && (
                  <Badge tone="attention">Processing Queue</Badge>
                )}
                {!isProcessing &&
                  stats.pending === 0 &&
                  stats.uploading === 0 && (
                    <Badge tone="success">Queue Complete</Badge>
                  )}
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {/* File Drop Zone */}
        <FileDropZone onFilesSelected={uploadQueue.addFiles} disabled={false} />

        {/* File Queue */}
        {stats.total > 0 && <FileQueue queue={uploadQueue} />}

        {/* Instructions */}
        {stats.total === 0 && (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">
                How to Test the Queue Management
              </Text>
              <BlockStack gap="200">
                <Text as="p">
                  🔥 <strong>Challenge Features:</strong>
                </Text>
                <Text as="p">
                  • <strong>Drag & drop multiple files</strong> to test queue
                  management
                </Text>
                <Text as="p">
                  • <strong>Max {maxConcurrent} concurrent uploads</strong> -
                  watch files queue up!
                </Text>
                <Text as="p">
                  • <strong>Auto-retry failed uploads</strong> (up to{" "}
                  {maxRetries} attempts)
                </Text>
                <Text as="p">
                  • <strong>Progress tracking</strong> for each file
                </Text>
                <Text as="p">
                  • <strong>Queue controls</strong> - start/stop/clear completed
                </Text>
              </BlockStack>

              <Text variant="bodySm" tone="subdued" as="p">
                💡 Try uploading 10+ files at once to see the queue management
                in action! Some uploads will randomly fail to demonstrate the
                retry logic.
              </Text>
            </BlockStack>
          </Card>
        )}

        {/* Demo Info */}
        <Card>
          <BlockStack gap="200">
            <Text variant="headingSm" as="h4">
              Demo Information
            </Text>
            <Text variant="bodySm" as="p">
              This is a <strong>mock upload system</strong> for demonstration
              purposes. Files are not actually uploaded to a server - instead,
              we simulate the upload process with progress tracking and random
              failures (~20% failure rate) to test the retry logic.
            </Text>
            <Text variant="bodySm" as="p">
              In a production environment, this would upload to S3, Digital
              Ocean Spaces, or another cloud storage service.
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
};
