import React, { useState, useEffect } from "react";
import { Pin, Reply, MoreVertical, Download, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { Paragraph } from "../Paragraph";
import { Badge } from "../Badge";
import { getFileDownloadUrl } from "../../services/r2-upload";
import type { Message, MessageAttachment } from "../../types";

interface MessageItemProps {
  message: Message;
  authorUsername?: string;
  onReply?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onScrollToReply?: (messageId: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  authorUsername = "Unknown",
  onReply,
  onPin,
  onScrollToReply,
}) => {
  const { currentUser, messages } = useAppStore();
  const isOwnMessage = message.author_id === currentUser?.id;

  // Find reply-to message if exists
  const replyToMessage = message.reply_to_message_id
    ? Object.values(messages)
        .flat()
        .find((m) => m.id === message.reply_to_message_id)
    : null;

  const formatTimestamp = (timestamp: number) => {
    const tsMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
    const date = new Date(tsMs);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleString();
  };

  const content =
    message.content_decrypted ??
    (message as any).content ??
    (message.content_encrypted ? "[Encrypted message]" : "[No content]");
  const statusBadge = message.status && message.status !== "sent" && (
    <Badge
      variant={message.status === "failed" ? "error" : "warning"}
      size="sm"
      className="ml-2"
    >
      {message.status}
    </Badge>
  );

  return (
    <div
      className={`px-4 py-3 hover:bg-orange-300/5 transition-colors group ${
        isOwnMessage ? "bg-orange-300/5" : ""
      }`}
    >
      {/* Reply preview */}
      {replyToMessage && (
        <button
          onClick={() => onScrollToReply?.(message.reply_to_message_id!)}
          className="mb-2 ml-8 pl-3 border-l-2 border-orange-300/30 text-left w-full hover:bg-orange-300/10 rounded px-2 py-1 transition-colors"
        >
          <Paragraph size="sm" className="text-orange-300/70 font-mono mb-0.5">
            Replying to {authorUsername}
          </Paragraph>
          <Paragraph size="sm" className="text-orange-300/50 truncate">
            {replyToMessage.content_decrypted?.substring(0, 80) ||
              "[Encrypted]"}
            ...
          </Paragraph>
        </button>
      )}

      <div className="flex items-start gap-3">
        {/* Avatar placeholder */}
        <div className="w-8 h-8 rounded-full bg-orange-300/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-mono text-orange-300">
            {authorUsername.charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Paragraph
              size="base"
              className="font-mono font-semibold text-orange-300"
            >
              {authorUsername}
            </Paragraph>
            <Paragraph size="sm" className="text-orange-300/50 font-mono">
              {formatTimestamp(message.timestamp)}
            </Paragraph>
            {message.is_pinned && (
              <Pin className="w-3 h-3 text-orange-300/70 flex-shrink-0" />
            )}
            {statusBadge}
          </div>

          <Paragraph
            size="base"
            className="text-orange-300/90 whitespace-pre-wrap break-words"
          >
            {content}
          </Paragraph>

          {/* File attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((attachment) => (
                <AttachmentDisplay key={attachment.id} attachment={attachment} />
              ))}
            </div>
          )}

          {/* Thread indicator */}
          {message.thread_id && message.thread_id !== message.id && (
            <button className="mt-2 text-xs text-orange-300/70 hover:text-orange-300 font-mono">
              View thread →
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onReply?.(message.id)}
            className="p-1.5 text-orange-300/70 hover:text-orange-300 hover:bg-orange-300/10 rounded transition-colors"
            aria-label="Reply"
          >
            <Reply className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPin?.(message.id)}
            className="p-1.5 text-orange-300/70 hover:text-orange-300 hover:bg-orange-300/10 rounded transition-colors"
            aria-label={message.is_pinned ? "Unpin" : "Pin"}
          >
            <Pin
              className={`w-4 h-4 ${
                message.is_pinned ? "text-orange-300" : ""
              }`}
            />
          </button>
          <button
            className="p-1.5 text-orange-300/70 hover:text-orange-300 hover:bg-orange-300/10 rounded transition-colors"
            aria-label="More options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Component to display file attachments
const AttachmentDisplay: React.FC<{ attachment: MessageAttachment }> = ({
  attachment,
}) => {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isImage = attachment.content_type.startsWith("image/");

  useEffect(() => {
    const loadDownloadUrl = async () => {
      if (downloadUrl) return; // Already loaded
      setIsLoading(true);
      try {
        const url = await getFileDownloadUrl(attachment.object_key);
        setDownloadUrl(url);
      } catch (err) {
        console.error("Failed to get download URL:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    };

    if (isImage || attachment.content_type.startsWith("image/")) {
      loadDownloadUrl();
    }
  }, [attachment.object_key, attachment.content_type, isImage, downloadUrl]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  const handleDownload = async () => {
    if (!downloadUrl && !isLoading) {
      setIsLoading(true);
      try {
        const url = await getFileDownloadUrl(attachment.object_key);
        setDownloadUrl(url);
        // Trigger download
        const link = document.createElement("a");
        link.href = url;
        link.download = attachment.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Download failed");
      } finally {
        setIsLoading(false);
      }
    } else if (downloadUrl) {
      // Trigger download
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isImage && downloadUrl) {
    return (
      <div className="mt-2">
        <img
          src={downloadUrl}
          alt={attachment.filename}
          className="max-w-md max-h-96 rounded border border-orange-300/20 cursor-pointer hover:border-orange-300/40 transition-colors"
          onClick={handleDownload}
        />
        <div className="mt-1 flex items-center gap-2 text-xs text-orange-300/70 font-mono">
          <span>{attachment.filename}</span>
          <span className="text-orange-300/50">({formatFileSize(attachment.file_size)})</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-orange-300/5 border border-orange-300/20 rounded">
      {isImage ? (
        <ImageIcon className="w-4 h-4 text-orange-300/70 flex-shrink-0" />
      ) : (
        <FileIcon className="w-4 h-4 text-orange-300/70 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-orange-300/90 font-mono truncate">
          {attachment.filename}
        </div>
        <div className="text-xs text-orange-300/50 font-mono">
          {formatFileSize(attachment.file_size)}
        </div>
      </div>
      {error ? (
        <span className="text-xs text-red-400 font-mono">{error}</span>
      ) : (
        <button
          onClick={handleDownload}
          disabled={isLoading}
          className="p-1.5 text-orange-300/70 hover:text-orange-300 hover:bg-orange-300/10 rounded transition-colors disabled:opacity-50"
          aria-label={`Download ${attachment.filename}`}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-orange-300/30 border-t-orange-300 rounded-full animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
};
