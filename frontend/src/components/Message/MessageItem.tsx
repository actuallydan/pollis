import React, { useState, useEffect } from "react";
import { Pin, Reply, MoreVertical, Download, Image as ImageIcon, File as FileIcon } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { getFileDownloadUrl } from "../../services/r2-upload";
import type { Message, MessageAttachment } from "../../types";

interface MessageItemProps {
  message: Message;
  allMessages?: Message[];
  authorUsername?: string;
  onReply?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onScrollToReply?: (messageId: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  allMessages = [],
  authorUsername = "Unknown",
  onReply,
  onPin,
  onScrollToReply,
}) => {
  const { currentUser } = useAppStore();
  const isOwnMessage = message.sender_id === currentUser?.id;

  const replyToMessage = message.reply_to_message_id
    ? allMessages.find((m) => m.id === message.reply_to_message_id)
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
    (message.ciphertext ? "[Encrypted message]" : "[No content]");

  const statusBadge = message.status && message.status !== "sent" && (
    <span data-testid="message-status">{message.status}</span>
  );

  return (
    <div
      data-testid={`message-${message.id}`}
      aria-label={`Message from ${authorUsername}`}
    >
      {replyToMessage && (
        <button
          data-testid={`reply-preview-${message.reply_to_message_id}`}
          onClick={() => onScrollToReply?.(message.reply_to_message_id!)}
        >
          <p>Replying to {authorUsername}</p>
          <p>{replyToMessage.content_decrypted?.substring(0, 80) || "[Encrypted]"}...</p>
        </button>
      )}

      <div>
        <div>
          <span>{authorUsername.charAt(0).toUpperCase()}</span>
        </div>

        <div>
          <div>
            <p data-testid="message-author">{authorUsername}</p>
            <p data-testid="message-timestamp">{formatTimestamp(message.created_at)}</p>
            {message.is_pinned && <Pin aria-hidden="true" />}
            {statusBadge}
          </div>

          <p data-testid="message-content">{content}</p>

          {message.attachments && message.attachments.length > 0 && (
            <div>
              {message.attachments.map((attachment) => (
                <AttachmentDisplay key={attachment.id} attachment={attachment} />
              ))}
            </div>
          )}

          {message.thread_id && message.thread_id !== message.id && (
            <button>View thread →</button>
          )}
        </div>

        <div>
          <button
            data-testid="reply-button"
            onClick={() => onReply?.(message.id)}
            aria-label="Reply"
          >
            <Reply aria-hidden="true" />
          </button>
          <button
            data-testid="pin-button"
            onClick={() => onPin?.(message.id)}
            aria-label={message.is_pinned ? "Unpin" : "Pin"}
          >
            <Pin aria-hidden="true" />
          </button>
          <button
            data-testid="message-more-button"
            aria-label="More options"
          >
            <MoreVertical aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

const AttachmentDisplay: React.FC<{ attachment: MessageAttachment }> = ({
  attachment,
}) => {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isImage = attachment.content_type.startsWith("image/");

  useEffect(() => {
    const loadDownloadUrl = async () => {
      if (downloadUrl) {
        return;
      }
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

    if (isImage) {
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
      <div>
        <img
          src={downloadUrl}
          alt={attachment.filename}
          onClick={handleDownload}
        />
        <div>
          <span>{attachment.filename}</span>
          <span>({formatFileSize(attachment.file_size)})</span>
        </div>
      </div>
    );
  }

  return (
    <div data-testid={`attachment-${attachment.id}`}>
      {isImage ? (
        <ImageIcon aria-hidden="true" />
      ) : (
        <FileIcon aria-hidden="true" />
      )}
      <div>
        <div>{attachment.filename}</div>
        <div>{formatFileSize(attachment.file_size)}</div>
      </div>
      {error ? (
        <span>{error}</span>
      ) : (
        <button
          onClick={handleDownload}
          disabled={isLoading}
          aria-label={`Download ${attachment.filename}`}
        >
          {isLoading ? "Loading..." : <Download aria-hidden="true" />}
        </button>
      )}
    </div>
  );
};
