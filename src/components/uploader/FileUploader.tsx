import React from "react";
import {
  Page,
  BlockStack,
  Text,
  Card,
  InlineStack,
  Badge,
  InlineGrid,
  Banner,
  Box,
} from "@shopify/polaris";
import { FileDropZone } from "./FileDropZone";
import { FileQueue } from "./FileQueue";
import { useUploadQueue } from "../../hooks/useUploadQueue";

export const FileUploader: React.FC = () => {
  const uploadQueue = useUploadQueue({
    maxConcurrent: 2,
    maxRetries: 3,
    autoStart: true,
  });

  const { files } = uploadQueue;
  const hasFiles = files.length > 0;

  return (
    <Page title="File Uploader">
      <BlockStack gap="600">
        {/* Prominent Header Section */}
        <Box paddingInlineStart="0" paddingInlineEnd="0">
          <BlockStack gap="300">
            <Text variant="headingXl" as="h1" alignment="center">
              Upload Your Files
            </Text>
            <Text tone="subdued" as="p" alignment="center" variant="bodyLg">
              Drag and drop files to upload them with automatic queue management
            </Text>
          </BlockStack>
        </Box>

        {/* Instructions Banner */}
        <Banner tone="info">
          <Text as="p">
            Drag and drop multiple files or click to select. Maximum 2 files
            will upload concurrently. Failed uploads will automatically retry up
            to 3 times.
          </Text>
        </Banner>

        {/* Main Content Grid */}
        <InlineGrid columns={{ xs: "1fr" }} gap="500">
          {/* Upload Drop Zone */}
          <Card roundedAbove="sm">
            <FileDropZone onFilesSelected={uploadQueue.addFiles} />
          </Card>

          {/* File Queue - Only show when there are files */}
          {hasFiles && (
            <Card roundedAbove="sm">
              <FileQueue queue={uploadQueue} />
            </Card>
          )}
        </InlineGrid>
      </BlockStack>
    </Page>
  );
};
