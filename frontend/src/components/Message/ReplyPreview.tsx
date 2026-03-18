import React from 'react';
import { X } from 'lucide-react';
import type { Message } from '../../types';

interface ReplyPreviewProps {
  messageId: string;
  allMessages: Message[];
  onDismiss: () => void;
  onScrollToMessage?: (messageId: string) => void;
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({
  messageId,
  allMessages,
  onDismiss,
  onScrollToMessage,
}) => {
  const message = allMessages.find((m) => m.id === messageId);
  if (!message) {
    return null;
  }
  const content = message.content_decrypted || '[Encrypted message]';
  const snippet = content.length > 100 ? content.substring(0, 100) + '...' : content;

  return (
    <div data-testid="reply-preview">
      <div>
        <div>
          <p>Replying to message</p>
        </div>
        <button
          data-testid="reply-preview-scroll-button"
          onClick={() => onScrollToMessage?.(messageId)}
          aria-label="Scroll to replied message"
        >
          <p>{snippet}</p>
        </button>
      </div>
      <button
        data-testid="dismiss-reply-button"
        onClick={onDismiss}
        aria-label="Dismiss reply"
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
};
