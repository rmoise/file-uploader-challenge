import React from "react";
import {
  Card,
  Text,
  Button,
  ProgressBar,
  Badge,
  InlineStack,
  BlockStack,
  Icon,
} from "@shopify/polaris";
import { DeleteIcon, RefreshIcon } from "@shopify/polaris-icons";
import type { FileUploadItem } from "../../types/upload";
import { formatFileSize, STATUS_MESSAGES } from "../../constants";

interface FileItemProps {
  file: FileUploadItem;
  onRetry: (fileId: string) => void;
  onRemove: (fileId: string) => void;
}

export const FileItem: React.FC<FileItemProps> = ({
  file,
  onRetry,
  onRemove,
}) => {
  const getStatusBadge = () => {
    switch (file.status) {
      case "pending":
        return <Badge tone="info">Pending</Badge>;
      case "uploading":
        return <Badge tone="attention">Uploading</Badge>;
      case "completed":
        return <Badge tone="success">Completed</Badge>;
      case "failed":
        return <Badge tone="critical">Failed</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const showProgress = file.status === "uploading" && file.progress > 0;
  const showRetry = file.status === "failed";
  const canRemove = file.status === "completed" || file.status === "failed";

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="100">
            <Text variant="bodyMd" as="p" fontWeight="medium">
              {file.file.name}
            </Text>
            <InlineStack gap="200" blockAlign="center">
              <Text variant="bodySm" tone="subdued" as="span">
                {formatFileSize(file.file.size)}
              </Text>
              {getStatusBadge()}
              {file.retryCount > 0 && (
                <Text variant="bodySm" tone="subdued" as="span">
                  Retry {file.retryCount}/3
                </Text>
              )}
            </InlineStack>
          </BlockStack>

          <InlineStack gap="200">
            {showRetry && (
              <Button
                size="micro"
                onClick={() => onRetry(file.id)}
                accessibilityLabel={`Retry upload for ${file.file.name}`}
                icon={RefreshIcon}
              />
            )}
            {canRemove && (
              <Button
                variant="plain"
                tone="critical"
                size="micro"
                onClick={() => onRemove(file.id)}
                accessibilityLabel={`Remove ${file.file.name}`}
                icon={DeleteIcon}
              />
            )}
          </InlineStack>
        </InlineStack>

        {showProgress && (
          <BlockStack gap="100">
            <ProgressBar progress={file.progress} />
            <Text variant="bodySm" tone="subdued" as="p">
              {file.progress}% uploaded
            </Text>
          </BlockStack>
        )}

        {file.error && (
          <Text variant="bodySm" tone="critical" as="p">
            Error: {file.error}
          </Text>
        )}
      </BlockStack>
    </Card>
  );
};
