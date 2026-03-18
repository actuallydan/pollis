import React from 'react';
import { X, Clock, Send, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

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
    return '[Pending message]';
  };

  const handleCancel = (queueItemId: string, _messageId: string) => {
    updateMessageQueueItem(queueItemId, { status: 'cancelled' });
    removeFromMessageQueue(queueItemId);
  };

  const handleRetry = (queueItemId: string) => {
    updateMessageQueueItem(queueItemId, {
      status: 'pending',
      retry_count: messageQueue.find((q) => q.id === queueItemId)?.retry_count || 0,
    });
  };

  return (
    <div data-testid="message-queue">
      <div>
        <h3>Message Queue</h3>
      </div>

      <div>
        {pendingMessages.length > 0 && (
          <div>
            {pendingMessages.map((item) => {
              const content = getMessageContent(item.message_id);
              const snippet = content.length > 60 ? content.substring(0, 60) + '...' : content;

              return (
                <div key={item.id} data-testid={`queue-item-${item.id}`}>
                  <div>
                    {item.status === 'sending' ? (
                      <Send aria-hidden="true" />
                    ) : (
                      <Clock aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <span data-testid="queue-item-status">{item.status}</span>
                    <p>{snippet}</p>
                  </div>
                  <button
                    data-testid={`cancel-queue-item-${item.id}`}
                    onClick={() => handleCancel(item.id, item.message_id)}
                    aria-label="Cancel message"
                  >
                    <X aria-hidden="true" />
                    Cancel
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {failedMessages.length > 0 && (
          <div>
            {failedMessages.map((item) => {
              const content = getMessageContent(item.message_id);
              const snippet = content.length > 60 ? content.substring(0, 60) + '...' : content;

              return (
                <div key={item.id} data-testid={`queue-item-failed-${item.id}`}>
                  <div>
                    <AlertCircle aria-hidden="true" />
                  </div>
                  <div>
                    <span>Failed (retry {item.retry_count})</span>
                    <p>{snippet}</p>
                  </div>
                  <div>
                    <button
                      data-testid={`retry-queue-item-${item.id}`}
                      onClick={() => handleRetry(item.id)}
                    >
                      Retry
                    </button>
                    <button
                      data-testid={`cancel-queue-item-${item.id}`}
                      onClick={() => handleCancel(item.id, item.message_id)}
                      aria-label="Cancel message"
                    >
                      <X aria-hidden="true" />
                      Cancel
                    </button>
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
