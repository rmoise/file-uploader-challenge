import React, { useCallback, useState } from "react";
import { Card, Text, Button, BlockStack, Icon } from "@shopify/polaris";
import { UploadIcon } from "@shopify/polaris-icons";

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFilesSelected,
  disabled = false,
}) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragActive(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [disabled, onFilesSelected]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;

      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        onFilesSelected(files);
      }
      // Reset input value to allow selecting same files again
      e.target.value = "";
    },
    [disabled, onFilesSelected]
  );

  const handleClick = useCallback(() => {
    if (disabled) return;

    const input = document.getElementById("file-input") as HTMLInputElement;
    input?.click();
  }, [disabled]);

  return (
    <Card>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        style={{
          padding: "2rem",
          textAlign: "center",
          border: isDragActive
            ? "2px dashed var(--p-color-border-brand)"
            : "2px dashed var(--p-color-border-subdued)",
          borderRadius: "var(--p-border-radius-200)",
          backgroundColor: isDragActive
            ? "var(--p-color-surface-brand-subdued)"
            : "var(--p-color-surface)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          transition: "all 0.2s ease",
        }}
      >
        <BlockStack gap="400" align="center">
          <Icon source={UploadIcon} tone={isDragActive ? "info" : "subdued"} />
          <BlockStack gap="200" align="center">
            <Text variant="headingMd" as="h3">
              {isDragActive ? "Drop files here" : "Upload files"}
            </Text>
            <Text tone="subdued" as="p">
              Drag and drop files here, or click to select files
            </Text>
            <Text tone="subdued" variant="bodySm" as="p">
              Multiple files supported
            </Text>
          </BlockStack>
          {!isDragActive && <Button disabled={disabled}>Choose Files</Button>}
        </BlockStack>

        <input
          id="file-input"
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ display: "none" }}
          disabled={disabled}
        />
      </div>
    </Card>
  );
};
