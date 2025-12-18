import React, { useState, useRef, useCallback } from "react";
import { Upload, X, File, Image, Video, Music, FileText } from "lucide-react";
import { Button } from "./Button";

/**
 * Extended File interface with optional preview URL for image files.
 * @interface FileWithPreview
 */
export interface FileWithPreview extends File {
  /** Optional preview URL for image files when preview mode is enabled */
  preview?: string;
}

/**
 * Props for the FilePicker component.
 * @interface FilePickerProps
 */
interface FilePickerProps {
  /** The label text displayed above the file picker */
  label: string;
  /** Callback function called when files are submitted */
  onFilesSubmit?: (files: FileWithPreview[]) => void;
  /** Callback function called immediately when files are selected (before submit) */
  onFilesChange?: (files: FileWithPreview[]) => void;
  /** Whether to show the submit button (default: true) */
  showSubmitButton?: boolean;
  /** Whether multiple files can be selected */
  multiple?: boolean;
  /** Comma-separated list of accepted file types (e.g., "image/*,.pdf") */
  accept?: string;
  /** Maximum number of files that can be selected */
  maxFiles?: number;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Whether to show image previews for image files */
  preview?: boolean;
  /** Optional descriptive text displayed below the file picker */
  description?: string;
  /** Error message to display below the file picker */
  error?: string;
  /** Whether the file picker is disabled and cannot be interacted with */
  disabled?: boolean;
  /** Whether the file picker is required (shows required indicator) */
  required?: boolean;
  /** Additional CSS classes to apply to the file picker container */
  className?: string;
  /** Unique identifier for the file picker input element */
  id?: string;
}

/**
 * A comprehensive file picker component with drag-and-drop support and file validation.
 *
 * The FilePicker component provides a user-friendly interface for selecting and uploading files:
 * - Drag-and-drop file upload with visual feedback
 * - Click to browse file selection
 * - File validation (size limits, file types)
 * - Image preview support for image files
 * - Multiple file selection support
 * - File type icons and size information
 * - Individual file removal
 * - File submission handling
 * - Comprehensive error handling and validation
 * - Accessibility features and ARIA attributes
 * - Responsive design with proper focus management
 *
 * @component
 * @param {FilePickerProps} props - The props for the FilePicker component
 * @param {string} props.label - The label text displayed above the file picker
 * @param {(files: FileWithPreview[]) => void} [props.onFilesSubmit] - Callback function called when files are submitted
 * @param {boolean} [props.multiple=false] - Whether multiple files can be selected
 * @param {string} [props.accept] - Comma-separated list of accepted file types
 * @param {number} [props.maxFiles=10] - Maximum number of files that can be selected
 * @param {number} [props.maxSize] - Maximum file size in bytes
 * @param {boolean} [props.preview=false] - Whether to show image previews for image files
 * @param {string} [props.description] - Optional descriptive text displayed below the file picker
 * @param {string} [props.error] - Error message to display below the file picker
 * @param {boolean} [props.disabled=false] - Whether the file picker is disabled
 * @param {boolean} [props.required=false] - Whether the file picker is required
 * @param {string} [props.className] - Additional CSS classes to apply to the container
 * @param {string} [props.id] - Unique identifier for the file picker input
 *
 * @example
 * ```tsx
 * // Basic single file picker
 * <FilePicker
 *   label="Upload Document"
 *   onFilesSubmit={(files) => console.log('Files:', files)}
 * />
 *
 * // Multiple file picker with restrictions
 * <FilePicker
 *   label="Upload Images"
 *   multiple={true}
 *   accept="image/*"
 *   maxFiles={5}
 *   maxSize={5 * 1024 * 1024} // 5MB
 *   preview={true}
 *   onFilesSubmit={handleImageUpload}
 * />
 *
 * // File picker with validation and description
 * <FilePicker
 *   label="Upload PDF Files"
 *   accept=".pdf,.doc,.docx"
 *   maxSize={10 * 1024 * 1024} // 10MB
 *   description="Please upload PDF, Word, or text documents only"
 *   required={true}
 *   error={fileError}
 *   onFilesSubmit={handleDocumentUpload}
 * />
 *
 * // Disabled state
 * <FilePicker
 *   label="Upload Files"
 *   disabled={true}
 *   description="File upload is currently unavailable"
 * />
 * ```
 *
 * @returns {JSX.Element} A file picker component with drag-and-drop support and file management
 */
export const FilePicker: React.FC<FilePickerProps> = ({
  label,
  onFilesSubmit,
  onFilesChange,
  showSubmitButton = true,
  multiple = false,
  accept,
  maxFiles = 10,
  maxSize,
  preview = false,
  description,
  error,
  disabled = false,
  required = false,
  className = "",
  id,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [_dragCounter, setDragCounter] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filePickerId =
    id || `filepicker-${Math.random().toString(36).substr(2, 9)}`;
  const descriptionId = description ? `${filePickerId}-description` : undefined;
  const errorId = error ? `${filePickerId}-error` : undefined;

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File ${file.name} is too large. Maximum size is ${formatFileSize(
        maxSize
      )}.`;
    }
    return null;
  };

  const processFiles = useCallback(
    (files: FileList | File[]): FileWithPreview[] => {
      const fileArray = Array.from(files);
      const validFiles: FileWithPreview[] = [];
      const errors: string[] = [];

      fileArray.forEach((file) => {
        const error = validateFile(file);
        if (error) {
          errors.push(error);
          return;
        }

        const fileWithPreview: FileWithPreview = file;

        if (preview && file.type.startsWith("image/")) {
          fileWithPreview.preview = URL.createObjectURL(file);
        }

        validFiles.push(fileWithPreview);
      });

      if (errors.length > 0) {
        setValidationErrors(errors);
      } else {
        setValidationErrors([]);
      }

      return validFiles;
    },
    [maxSize, preview]
  );

  const handleFileSelect = useCallback(
    (files: FileList | File[]) => {
      if (disabled) return;

      const newFiles = processFiles(files);

      let updatedFiles: FileWithPreview[];
      if (multiple) {
        updatedFiles = [...selectedFiles, ...newFiles].slice(0, maxFiles);
      } else {
        updatedFiles = newFiles.slice(0, 1);
      }

      setSelectedFiles(updatedFiles);

      // Call onFilesChange immediately when files are selected
      if (onFilesChange) {
        onFilesChange(updatedFiles);
      }
    },
    [selectedFiles, multiple, maxFiles, disabled, processFiles, onFilesChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFileSelect(files);
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newCounter = prev - 1;
      if (newCounter <= 0) {
        setIsDragOver(false);
      }
      return newCounter;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      setDragCounter(0);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files) {
        handleFileSelect(files);
      }
    },
    [disabled, handleFileSelect]
  );

  const removeFile = (index: number) => {
    const file = selectedFiles[index];
    if (file.preview) {
      URL.revokeObjectURL(file.preview);
    }

    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
  };

  const handleSubmit = () => {
    if (onFilesSubmit) {
      onFilesSubmit(selectedFiles);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return Image;
    if (file.type.startsWith("video/")) return Video;
    if (file.type.startsWith("audio/")) return Music;
    if (file.type.includes("text") || file.type.includes("document"))
      return FileText;
    return File;
  };

  const baseClasses = `
    relative w-full
  `;

  const labelClasses = `
    block text-sm font-sans font-medium text-orange-300 mb-2
  `;

  const descriptionClasses = `
    mt-1 text-xs font-sans text-orange-300/80
  `;

  const errorClasses = `
    mt-1 text-xs font-sans text-red-400
  `;

  const dropzoneClasses = `
    w-full p-8 border-2 border-dashed rounded-md text-center transition-all duration-200
    font-sans text-base
    ${
      isDragOver
        ? "border-orange-300 bg-orange-300/10"
        : "border-orange-300/50 hover:border-orange-300/80 hover:bg-orange-300/5"
    }
    ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
    ${error ? "border-red-400" : ""}
    outline-none focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black
  `;

  return (
    <div className={`${baseClasses} ${className}`}>
      <label htmlFor={filePickerId} className={labelClasses}>
        {label}
        {required && (
          <span className="text-red-400 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>

      <div
        className={dropzoneClasses}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            fileInputRef.current?.click();
          } else if (e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-describedby={
          [descriptionId, errorId].filter(Boolean).join(" ") || undefined
        }
        aria-invalid={!!error}
      >
        <input
          ref={fileInputRef}
          id={filePickerId}
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
          required={required}
          tabIndex={-1}
          style={{ outline: "none" }}
          onFocus={(e) => {
            // Prevent the hidden input from receiving focus
            e.target.blur();
          }}
        />

        <Upload className="w-8 h-8 text-orange-300 mx-auto mb-2" />
        <p className="text-orange-300 font-medium mb-1">
          {isDragOver ? "Drop files here" : "Click to upload or drag and drop"}
        </p>
        <p className="text-orange-300/80 text-sm">
          {multiple ? "Multiple files allowed" : "Single file only"}
          {accept && ` • ${accept}`}
          {maxSize && ` • Max ${formatFileSize(maxSize)}`}
        </p>
      </div>

      {/* File List */}
      {selectedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="font-sans font-medium text-orange-300 text-sm">
            Selected Files ({selectedFiles.length})
          </h4>
          <div className="space-y-2">
            {selectedFiles.map((file: FileWithPreview, index: number) => {
              const FileIcon = getFileIcon(file);
              return (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-3 p-3 border border-orange-300/30 rounded-md bg-black"
                >
                  {preview && file.preview && file.type.startsWith("image/") ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-12 h-12 object-cover rounded border border-orange-300/30"
                    />
                  ) : (
                    <FileIcon className="w-12 h-12 text-orange-300/80" />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-orange-300 text-sm truncate">
                      {file.name}
                    </p>
                    <p className="font-sans text-orange-300/60 text-xs">
                      {formatFileSize(file.size)}
                    </p>
                  </div>

                  <Button
                    onClick={() => removeFile(index)}
                    variant="secondary"
                    className="p-1 h-auto"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Submit Button */}
          {showSubmitButton && (
            <Button
              onClick={handleSubmit}
              className="mt-3"
              disabled={selectedFiles.length === 0}
            >
              Submit Files
            </Button>
          )}
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mt-4 p-3 bg-yellow-400/20 border border-yellow-400/50 rounded-md">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-yellow-400 text-sm">
              <p className="font-medium mb-1">File validation errors:</p>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {description && !error && (
        <p id={descriptionId} className={descriptionClasses}>
          {description}
        </p>
      )}

      {error && (
        <p id={errorId} className={errorClasses} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
