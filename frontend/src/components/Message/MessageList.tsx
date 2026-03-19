import React, { useEffect, useRef, useMemo, useState } from "react";
import { VariableSizeList as List } from "react-window";
import { MessageItem } from "./MessageItem";
import type { Message } from "../../types";

interface MessageListProps {
  messages: Message[];
  onReply?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onScrollToMessage?: (messageId: string) => void;
  getAuthorUsername?: (authorId: string) => string;
}

interface ListItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    messages: Message[];
    onReply?: (messageId: string) => void;
    onPin?: (messageId: string) => void;
    onScrollToMessage?: (messageId: string) => void;
    getAuthorUsername?: (authorId: string) => string;
    setItemSize: (index: number, size: number) => void;
  };
}

const ListItem: React.FC<ListItemProps> = ({ index, style, data }) => {
  const message = data.messages[index];
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (itemRef.current) {
      const height = itemRef.current.getBoundingClientRect().height;
      data.setItemSize(index, height);
    }
  }, [index, data, message]);

  if (!message) {
    return null;
  }

  const authorUsername = data.getAuthorUsername
    ? data.getAuthorUsername(message.sender_id)
    : "Unknown";

  return (
    <div ref={itemRef} style={style}>
      <MessageItem
        message={message}
        allMessages={data.messages}
        authorUsername={authorUsername}
        onReply={data.onReply}
        onPin={data.onPin}
        onScrollToReply={data.onScrollToMessage}
      />
    </div>
  );
};

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  onReply,
  onPin,
  onScrollToMessage,
  getAuthorUsername,
}) => {
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const [containerWidth, setContainerWidth] = useState(800);
  const itemHeightsRef = useRef<Map<number, number>>(new Map());

  const updateDimensions = React.useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const height = rect.height;
      const width = rect.width;

      if (height > 0 && width > 0) {
        setContainerHeight((prevHeight) => {
          if (prevHeight !== height) return height;
          return prevHeight;
        });
        setContainerWidth((prevWidth) => {
          if (prevWidth !== width) return width;
          return prevWidth;
        });
      }
    }
  }, []);

  const setContainerRef = React.useCallback((node: HTMLDivElement | null) => {
    if (node) {
      containerRef.current = node;

      const rect = node.getBoundingClientRect();
      if (rect.height > 0 && rect.width > 0) {
        setContainerHeight(rect.height);
        setContainerWidth(rect.width);
      }

      if (typeof ResizeObserver !== "undefined") {
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
        }

        resizeObserverRef.current = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { height, width } = entry.contentRect;
            if (height > 0 && width > 0) {
              setContainerHeight(height);
              setContainerWidth(width);
            }
          }
        });
        resizeObserverRef.current.observe(node);
      }
    } else {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const measure = () => {
      updateDimensions();
    };

    measure();

    const rafId1 = requestAnimationFrame(() => {
      measure();

      const rafId2 = requestAnimationFrame(() => {
        measure();
      });
      return () => cancelAnimationFrame(rafId2);
    });

    window.addEventListener("resize", updateDimensions);

    return () => {
      cancelAnimationFrame(rafId1);
      window.removeEventListener("resize", updateDimensions);
    };
  }, [updateDimensions]);

  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(messages.length - 1, "end");
    }
  }, [messages.length]);

  const scrollToMessage = (messageId: string) => {
    const index = messages.findIndex((m) => m.id === messageId);
    if (index !== -1 && listRef.current) {
      listRef.current.scrollToItem(index, "center");
    }
    onScrollToMessage?.(messageId);
  };

  const getItemSize = (index: number): number => {
    return itemHeightsRef.current.get(index) || 100;
  };

  const setItemSize = (index: number, size: number) => {
    if (itemHeightsRef.current.get(index) !== size) {
      itemHeightsRef.current.set(index, size);
      if (listRef.current) {
        listRef.current.resetAfterIndex(index);
      }
    }
  };

  const itemData = useMemo(
    () => ({
      messages,
      onReply,
      onPin,
      onScrollToMessage: scrollToMessage,
      getAuthorUsername,
      setItemSize,
    }),
    [messages, onReply, onPin, getAuthorUsername]
  );

  if (messages.length === 0) {
    return (
      <div
        data-testid="empty-messages"
        className="flex-1 flex items-center justify-center"
        style={{ background: 'var(--c-bg)' }}
      >
        <p className="text-xs font-mono" style={{ color: 'var(--c-text-muted)' }}>
          No messages yet. Start the conversation.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="message-list"
      ref={setContainerRef}
      style={{ flex: 1, overflow: "hidden", height: "100%", width: "100%", minHeight: 0, background: 'var(--c-bg)' }}
    >
      {containerHeight > 0 && containerWidth > 0 ? (
        <List
          ref={listRef}
          height={containerHeight}
          width={containerWidth}
          itemCount={messages.length}
          itemSize={getItemSize}
          itemData={itemData}
          estimatedItemSize={100}
        >
          {ListItem}
        </List>
      ) : (
        <div
          data-testid="loading-messages"
          className="flex items-center justify-center h-full"
        >
          <p className="text-xs font-mono" style={{ color: 'var(--c-text-muted)' }}>Loading…</p>
        </div>
      )}
    </div>
  );
};
