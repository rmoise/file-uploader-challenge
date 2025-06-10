import React, { useCallback, useState } from "react";
import { Text, Button, BlockStack, Icon } from "@shopify/polaris";
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
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      style={{
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        border: isDragActive ? "3px dashed #0070f3" : "2px dashed #b3d4fc",
        borderRadius: "12px",
        backgroundColor: isDragActive ? "#e6f3ff" : "#f0f8ff",
        transition: "all 0.2s ease",
        padding: "2rem",
        minHeight: "160px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <BlockStack gap="400" align="center">
        {/* Clean Upload Icon */}
        <Icon source={UploadIcon} tone={isDragActive ? "info" : "subdued"} />

        {/* Minimal Text Hierarchy */}
        <BlockStack gap="100" align="center">
          <Text variant="headingMd" as="h3" alignment="center">
            {isDragActive ? "Drop files here" : "Upload files"}
          </Text>
          <Text tone="subdued" as="p" alignment="center">
            Drag & drop or click to browse
          </Text>
        </BlockStack>

        {/* Simple CTA Button */}
        {!isDragActive && (
          <Button variant="primary" disabled={disabled}>
            Choose files
          </Button>
        )}
      </BlockStack>

      {/* Hidden File Input */}
      <input
        id="file-input"
        type="file"
        multiple
        onChange={handleFileSelect}
        style={{ display: "none" }}
        disabled={disabled}
      />
    </div>
  );
};
