import React from 'react';
import { X, Clock, Send, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { Card, Badge, Button, Paragraph, Header } from 'monopollis';

export const MessageQueue: React.FC = () => {
  const {
    messageQueue,
    removeFromMessageQueue,
    updateMessageQueueItem,
  } = useAppStore();

  const pendingMessages = messageQueue.filter(
    (item) => item.status === 'pending' || item.status === 'sending'
  );

  const failedMessages = messageQueue.filter((item) => item.status === 'failed');

  if (pendingMessages.length === 0 && failedMessages.length === 0) {
    return null;
  }

  const getMessageContent = (_messageId: string): string => {
    // TODO: When implementing the message queue feature, store content in
    // the queue item itself or use React Query cache lookup
    return '[Pending message]';
  };

  const handleCancel = (queueItemId: string, messageId: string) => {
    updateMessageQueueItem(queueItemId, { status: 'cancelled' });
    // Note: In a real implementation, you'd also delete the message from the messages store
    // and potentially call a backend method to cancel it
    removeFromMessageQueue(queueItemId);
  };

  const handleRetry = (queueItemId: string) => {
    updateMessageQueueItem(queueItemId, {
      status: 'pending',
      retry_count: messageQueue.find((q) => q.id === queueItemId)?.retry_count || 0,
    });
  };

  return (
    <div className="border-t border-orange-300/20 bg-black">
      <div className="px-4 py-2 border-b border-orange-300/10">
        <Header size="sm" className="text-orange-300/80">
          Message Queue
        </Header>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {/* Pending/Sending Messages */}
        {pendingMessages.length > 0 && (
          <div className="py-2">
            {pendingMessages.map((item) => {
              const content = getMessageContent(item.message_id);
              const snippet = content.length > 60 ? content.substring(0, 60) + '...' : content;

              return (
                <div
                  key={item.id}
                  className="px-4 py-2 border-b border-orange-300/10 hover:bg-orange-300/5 transition-colors flex items-start gap-3"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {item.status === 'sending' ? (
                      <Send className="w-4 h-4 text-orange-300/70 animate-pulse" />
                    ) : (
                      <Clock className="w-4 h-4 text-orange-300/70" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={item.status === 'sending' ? 'warning' : 'default'}
                        size="sm"
                      >
                        {item.status}
                      </Badge>
                    </div>
                    <Paragraph size="sm" className="text-orange-300/80 font-mono truncate">
                      {snippet}
                    </Paragraph>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => handleCancel(item.id, item.message_id)}
                    className="flex-shrink-0"
                    icon={<X className="w-3 h-3" />}
                  >
                    Cancel
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Failed Messages */}
        {failedMessages.length > 0 && (
          <div className="py-2 border-t border-orange-300/20">
            {failedMessages.map((item) => {
              const content = getMessageContent(item.message_id);
              const snippet = content.length > 60 ? content.substring(0, 60) + '...' : content;

              return (
                <div
                  key={item.id}
                  className="px-4 py-2 border-b border-orange-300/10 hover:bg-orange-300/5 transition-colors flex items-start gap-3"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <AlertCircle className="w-4 h-4 text-red-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="error" size="sm">
                        Failed (retry {item.retry_count})
                      </Badge>
                    </div>
                    <Paragraph size="sm" className="text-orange-300/80 font-mono truncate">
                      {snippet}
                    </Paragraph>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="secondary"
                      onClick={() => handleRetry(item.id)}
                      className="text-xs"
                    >
                      Retry
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleCancel(item.id, item.message_id)}
                      className="flex-shrink-0"
                      icon={<X className="w-3 h-3" />}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

