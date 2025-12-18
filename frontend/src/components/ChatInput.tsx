import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  ChevronRight,
  Plus,
  X,
  Image as ImageIcon,
  File as FileIcon,
  Loader2,
} from "lucide-react";
import { uploadFileAttachment } from "../services/r2-upload";
import { useAppStore } from "../stores/appStore";
import type { MessageAttachment } from "../types";

export interface Attachment {
  id: string;
  file: File;
  preview?: string;
  type: "image" | "file";
  objectKey?: string; // R2 object key after upload
  uploadProgress?: number;
  uploadError?: string;
  uploading?: boolean;
}

interface ChatInputProps {
  onSend: (message: string, attachments: Attachment[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxAttachments?: number;
  maxFileSize?: number; // in bytes
  acceptedFileTypes?: string[];
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  placeholder = "Type a message...",
  disabled = false,
  className = "",
  maxAttachments = 5,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  acceptedFileTypes = ["image/*", ".pdf", ".doc", ".docx", ".txt"],
}) => {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { selectedChannelId, selectedConversationId } = useAppStore();

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  // Add file to attachments and upload to R2
  const handleFileAdd = useCallback(
    async (file: File) => {
      if (attachments.length >= maxAttachments) {
        alert(`Maximum ${maxAttachments} attachments allowed`);
        return;
      }

      if (file.size > maxFileSize) {
        alert(
          `File ${file.name} is too large. Maximum size is ${formatFileSize(
            maxFileSize
          )}.`
        );
        return;
      }

      const attachmentId = `${Date.now()}-${Math.random()}`;
      const attachment: Attachment = {
        id: attachmentId,
        file,
        type: file.type.startsWith("image/") ? "image" : "file",
        uploading: true,
        uploadProgress: 0,
      };

      // Generate preview for images
      if (attachment.type === "image") {
        const reader = new FileReader();
        reader.onload = (e) => {
          attachment.preview = e.target?.result as string;
          setAttachments((prev) => [...prev, attachment]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachments((prev) => [...prev, attachment]);
      }

      // Upload to R2
      try {
        const response = await uploadFileAttachment(
          selectedChannelId,
          selectedConversationId,
          null, // message not created yet
          file,
          (progress) => {
            setAttachments((prev) =>
              prev.map((att) =>
                att.id === attachmentId
                  ? { ...att, uploadProgress: progress }
                  : att
              )
            );
          }
        );

        // Update attachment with R2 object key
        setAttachments((prev) =>
          prev.map((att) =>
            att.id === attachmentId
              ? {
                  ...att,
                  objectKey: response.object_key,
                  uploading: false,
                  uploadProgress: 100,
                }
              : att
          )
        );
      } catch (error) {
        console.error("Failed to upload file:", error);
        setAttachments((prev) =>
          prev.map((att) =>
            att.id === attachmentId
              ? {
                  ...att,
                  uploading: false,
                  uploadError: error instanceof Error ? error.message : "Upload failed",
                }
              : att
          )
        );
      }
    },
    [attachments.length, maxAttachments, maxFileSize, selectedChannelId, selectedConversationId]
  );

  // Dynamic height growth for textarea (min 1 row, max 6 rows)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const lineHeight = 24; // 1.5rem = 24px
      const minHeight = lineHeight; // 1 row minimum
      const maxHeight = lineHeight * 6; // 6 rows maximum
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [message, attachments]);

  // Handle paste events for clipboard images/files
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      let hasFiles = false;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            handleFileAdd(file);
            hasFiles = true;
          }
        } else if (item.type.startsWith("text/")) {
          // Only let text paste if there are no files
          if (hasFiles) {
            e.preventDefault();
            return;
          }
          continue;
        } else {
          // Try to get as file
          const file = item.getAsFile();
          if (file) {
            handleFileAdd(file);
            hasFiles = true;
          }
        }
      }

      // If we found files, prevent the default paste behavior
      if (hasFiles) {
        e.preventDefault();
      }
    },
    [handleFileAdd]
  );

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      files.forEach(handleFileAdd);
    },
    [handleFileAdd]
  );

  // Handle file selection from input
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach(handleFileAdd);

      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFileAdd]
  );

  // Remove attachment
  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  // Send message
  const handleSend = () => {
    if (!message.trim() && attachments.length === 0) return;

    // Only send attachments that have been successfully uploaded
    const uploadedAttachments = attachments.filter(
      (att) => att.objectKey && !att.uploading && !att.uploadError
    );

    if (attachments.length > 0 && uploadedAttachments.length === 0) {
      alert("Please wait for file uploads to complete");
      return;
    }

    onSend(message.trim(), uploadedAttachments);
    setMessage("");
    setAttachments([]);

    // Focus back to textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Handle Enter key (Shift+Enter for new line, Enter to send)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={`
        w-full border-t border-orange-300/20 bg-black
        ${isDragOver ? "bg-orange-300/5" : ""}
        ${className}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Compact inline attachments */}
      {attachments.length > 0 && (
        <div className="px-2 py-1 border-b border-orange-300/10 flex items-center gap-1.5 flex-wrap">
          {attachments.map((attachment) => {
            const FileIconComponent =
              attachment.type === "image" ? ImageIcon : FileIcon;
            const isUploading = attachment.uploading || !attachment.objectKey;
            const hasError = !!attachment.uploadError;
            return (
              <div
                key={attachment.id}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 border rounded text-xs font-mono ${
                  hasError
                    ? "bg-red-900/20 border-red-500/30"
                    : isUploading
                    ? "bg-orange-300/10 border-orange-300/20"
                    : "bg-orange-300/10 border-orange-300/20"
                }`}
              >
                {isUploading ? (
                  <Loader2 className="w-3 h-3 text-orange-300/70 flex-shrink-0 animate-spin" />
                ) : hasError ? (
                  <X className="w-3 h-3 text-red-500 flex-shrink-0" />
                ) : (
                  <FileIconComponent className="w-3 h-3 text-orange-300/70 flex-shrink-0" />
                )}
                <span
                  className={`truncate max-w-[120px] ${
                    hasError ? "text-red-400" : "text-orange-300/90"
                  }`}
                >
                  {attachment.file.name}
                </span>
                {!hasError && (
                  <span className="text-orange-300/50 text-[10px]">
                    {isUploading
                      ? `${Math.round(attachment.uploadProgress || 0)}%`
                      : formatFileSize(attachment.file.size)}
                  </span>
                )}
                {hasError && (
                  <span className="text-red-400 text-[10px]" title={attachment.uploadError}>
                    error
                  </span>
                )}
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="ml-0.5 hover:text-orange-300 text-orange-300/50 transition-colors cursor-pointer focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black"
                  aria-label={`Remove ${attachment.file.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          {attachments.length > 0 && (
            <button
              onClick={() => setAttachments([])}
              className="text-xs text-orange-300/50 hover:text-orange-300 font-mono px-1.5 py-0.5 transition-colors cursor-pointer focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black"
            >
              clear
            </button>
          )}
        </div>
      )}

      {/* Compact input area */}
      <div className="flex items-start gap-1 px-2 py-1">
        {/* Minimal attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || attachments.length >= maxAttachments}
          className="p-1.5 text-orange-300/90 hover:text-orange-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors flex-shrink-0 focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black"
          aria-label="Add attachment"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Terminal-style textarea */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            disabled={disabled}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            className={`w-full px-2 py-1 resize-none font-mono text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed overflow-y-auto rounded-sm ${
              isFocused
                ? "bg-orange-300 text-black placeholder-black/50 focus:outline-none"
                : "bg-orange-300/10 text-orange-300 placeholder-orange-300/30 focus:outline-none"
            }`}
            rows={1}
            style={{
              lineHeight: "1.5rem",
              minHeight: "1.5rem",
            }}
            aria-label="Message input"
          />
        </div>

        {/* Minimal send button */}
        <button
          onClick={handleSend}
          disabled={disabled || (!message.trim() && attachments.length === 0)}
          className="p-1.5 text-orange-300/90 hover:text-orange-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors flex-shrink-0 focus:outline-none focus:ring-4 focus:ring-orange-300 focus:ring-offset-2 focus:ring-offset-black"
          aria-label="Send message"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedFileTypes.join(",")}
        onChange={handleFileSelect}
        className="hidden"
        aria-label="File attachment input"
      />

      {/* Minimal drag and drop hint */}
      {isDragOver && (
        <div className="px-2 py-1 text-center text-xs text-orange-300/60 font-mono border-t border-orange-300/10">
          drop files
        </div>
      )}
    </div>
  );
};
