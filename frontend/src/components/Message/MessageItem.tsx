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

const formatTimestamp = (timestamp: number): string => {
  const tsMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const diffMs = Date.now() - tsMs;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(tsMs).toLocaleDateString();
};

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  allMessages = [],
  authorUsername = "unknown",
  onReply,
  onPin,
  onScrollToReply,
}) => {
  const { currentUser } = useAppStore();
  const isOwn = message.sender_id === currentUser?.id;

  const replyTo = message.reply_to_message_id
    ? allMessages.find((m) => m.id === message.reply_to_message_id)
    : null;

  const content =
    message.content_decrypted ??
    (message as any).content ??
    (message.ciphertext ? "[encrypted]" : "");

  return (
    <div
      data-testid={`message-${message.id}`}
      aria-label={`Message from ${authorUsername}`}
      className="group relative px-4 py-1.5 hover:bg-[var(--c-hover)] transition-colors duration-75"
    >
      {/* Reply context */}
      {replyTo && (
        <button
          data-testid={`reply-preview-${message.reply_to_message_id}`}
          onClick={() => onScrollToReply?.(message.reply_to_message_id!)}
          className="flex items-center gap-1.5 mb-1 pl-6 text-2xs hover:opacity-80 transition-opacity cursor-pointer"
          style={{ color: 'var(--c-text-muted)' }}
        >
          <Reply size={12} aria-hidden="true" style={{ transform: 'scaleX(-1)' }} />
          <span>{authorUsername}</span>
          <span className="truncate max-w-xs" style={{ color: 'var(--c-text-dim)' }}>
            {replyTo.content_decrypted?.slice(0, 60) || "[encrypted]"}
          </span>
        </button>
      )}

      {/* Main message row */}
      <div className="flex items-start gap-2.5">
        {/* Avatar initial */}
        <div
          className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-2xs font-mono font-bold mt-0.5"
          style={{
            background: isOwn ? 'var(--c-active)' : 'var(--c-hover)',
            color: isOwn ? 'var(--c-accent)' : 'var(--c-text-dim)',
            border: '1px solid var(--c-border)',
          }}
        >
          {authorUsername.charAt(0).toUpperCase()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span
              data-testid="message-author"
              className="text-xs font-mono font-medium"
              style={{ color: isOwn ? 'var(--c-accent)' : 'var(--c-accent-dim)' }}
            >
              {authorUsername}
            </span>
            <span
              data-testid="message-timestamp"
              className="text-2xs font-mono"
              style={{ color: 'var(--c-text-muted)' }}
            >
              {formatTimestamp(message.created_at)}
            </span>
            {message.is_pinned && (
              <Pin size={12} aria-hidden="true" style={{ color: 'var(--c-text-muted)' }} />
            )}
            {message.status && message.status !== "sent" && (
              <span
                data-testid="message-status"
                className="text-2xs font-mono"
                style={{ color: 'var(--c-text-muted)' }}
              >
                {message.status}
              </span>
            )}
          </div>

          <p
            data-testid="message-content"
            className="text-xs leading-relaxed break-words"
            style={{ color: 'var(--c-text-dim)' }}
          >
            {content}
          </p>

          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-1 flex flex-col gap-1">
              {message.attachments.map((a) => (
                <AttachmentDisplay key={a.id} attachment={a} />
              ))}
            </div>
          )}
        </div>

        {/* Hover actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            data-testid="reply-button"
            onClick={() => onReply?.(message.id)}
            aria-label="Reply"
            className="icon-btn-sm"
          >
            <Reply size={17} aria-hidden="true" />
          </button>
          <button
            data-testid="pin-button"
            onClick={() => onPin?.(message.id)}
            aria-label={message.is_pinned ? "Unpin" : "Pin"}
            className="icon-btn-sm"
          >
            <Pin size={17} aria-hidden="true" />
          </button>
          <button
            data-testid="message-more-button"
            aria-label="More options"
            className="icon-btn-sm"
          >
            <MoreVertical size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

const AttachmentDisplay: React.FC<{ attachment: MessageAttachment }> = ({ attachment }) => {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isImage = attachment.content_type.startsWith("image/");

  useEffect(() => {
    if (!isImage || downloadUrl) {
      return;
    }
    setIsLoading(true);
    getFileDownloadUrl(attachment.object_key)
      .then(setDownloadUrl)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setIsLoading(false));
  }, [attachment.object_key, isImage, downloadUrl]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))}${sizes[i]}`;
  };

  const handleDownload = async () => {
    const url = downloadUrl ?? await getFileDownloadUrl(attachment.object_key);
    if (!downloadUrl) {
      setDownloadUrl(url);
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = attachment.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (isImage && downloadUrl) {
    return (
      <div
        className="rounded overflow-hidden"
        style={{ border: '1px solid var(--c-border)', maxWidth: 280 }}
      >
        <img src={downloadUrl} alt={attachment.filename} className="block max-w-full" />
        <div
          className="flex items-center justify-between px-2 py-1"
          style={{ background: 'var(--c-surface-high)' }}
        >
          <span className="text-2xs font-mono truncate" style={{ color: 'var(--c-text-dim)' }}>
            {attachment.filename}
          </span>
          <span className="text-2xs font-mono" style={{ color: 'var(--c-text-muted)' }}>
            {formatFileSize(attachment.file_size)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`attachment-${attachment.id}`}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded"
      style={{ border: '1px solid var(--c-border)', background: 'var(--c-surface-high)', maxWidth: 280 }}
    >
      {isImage ? (
        <ImageIcon size={19} aria-hidden="true" style={{ color: 'var(--c-text-dim)', flexShrink: 0 }} />
      ) : (
        <FileIcon size={19} aria-hidden="true" style={{ color: 'var(--c-text-dim)', flexShrink: 0 }} />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono truncate" style={{ color: 'var(--c-accent-dim)' }}>
          {attachment.filename}
        </div>
        <div className="text-2xs font-mono" style={{ color: 'var(--c-text-muted)' }}>
          {formatFileSize(attachment.file_size)}
        </div>
      </div>
      {error ? (
        <span className="text-2xs" style={{ color: 'var(--c-text-muted)' }}>{error}</span>
      ) : (
        <button
          onClick={handleDownload}
          disabled={isLoading}
          aria-label={`Download ${attachment.filename}`}
          className="icon-btn-sm flex-shrink-0"
        >
          {isLoading ? "…" : <Download size={17} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
};
