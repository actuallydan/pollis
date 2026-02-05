import React from 'react';
import { X } from 'lucide-react';
import { Paragraph } from 'monopollis';
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
  // Find the message being replied to
  const message = allMessages.find((m) => m.id === messageId);
  if (!message) {
    return null;
  }
  const content = message.content_decrypted || '[Encrypted message]';
  const snippet = content.length > 100 ? content.substring(0, 100) + '...' : content;

  return (
    <div className="px-4 py-2 border-b border-orange-300/20 bg-orange-300/5 flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-0.5 h-4 bg-orange-300" />
          <Paragraph size="sm" className="text-orange-300/70 font-mono">
            Replying to message
          </Paragraph>
        </div>
        <button
          onClick={() => onScrollToMessage?.(messageId)}
          className="text-left w-full hover:bg-orange-300/10 rounded px-2 py-1 transition-colors"
        >
          <Paragraph size="sm" className="text-orange-300/90 truncate">
            {snippet}
          </Paragraph>
        </button>
      </div>
      <button
        onClick={onDismiss}
        className="p-1 text-orange-300/70 hover:text-orange-300 hover:bg-orange-300/10 rounded transition-colors flex-shrink-0"
        aria-label="Dismiss reply"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

