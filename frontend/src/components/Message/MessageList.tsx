import React, { useEffect, useRef, useMemo, useState } from "react";
import { VariableSizeList as List } from "react-window";
import { MessageItem } from "./MessageItem";
import { Paragraph } from "../Paragraph";
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

  if (!message) return null;

  const authorUsername = data.getAuthorUsername
    ? data.getAuthorUsername(message.author_id)
    : "Unknown";

  return (
    <div ref={itemRef} style={style}>
      <MessageItem
        message={message}
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

  // Update dimensions function
  const updateDimensions = React.useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const height = rect.height;
      const width = rect.width;
      
      // Only update if dimensions are valid
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

  // Set up container ref callback to measure immediately on mount
  const setContainerRef = React.useCallback((node: HTMLDivElement | null) => {
    if (node) {
      containerRef.current = node;
      
      // Measure immediately
      const rect = node.getBoundingClientRect();
      if (rect.height > 0 && rect.width > 0) {
        setContainerHeight(rect.height);
        setContainerWidth(rect.width);
      }
      
      // Set up ResizeObserver
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

  // Calculate container dimensions on mount and resize
  useEffect(() => {
    // Initial measurement with multiple attempts to catch layout
    const measure = () => {
      updateDimensions();
    };

    // Try immediately
    measure();
    
    // Try after layout (requestAnimationFrame)
    const rafId1 = requestAnimationFrame(() => {
      measure();
      
      // Try again after a microtask
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      listRef.current.scrollToItem(messages.length - 1, "end");
    }
  }, [messages.length]);

  // Scroll to specific message
  const scrollToMessage = (messageId: string) => {
    const index = messages.findIndex((m) => m.id === messageId);
    if (index !== -1 && listRef.current) {
      listRef.current.scrollToItem(index, "center");
    }
    onScrollToMessage?.(messageId);
  };

  // Get item size (with caching)
  const getItemSize = (index: number): number => {
    return itemHeightsRef.current.get(index) || 100;
  };

  // Set item size when measured
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
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Paragraph size="base" className="text-orange-300/70 font-mono">
            No messages yet. Start the conversation!
          </Paragraph>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={setContainerRef} 
      className="flex-1 overflow-hidden h-full w-full"
      style={{ minHeight: 0 }}
    >
      {containerHeight > 0 && containerWidth > 0 ? (
        <List
          ref={listRef}
          height={containerHeight}
          width={containerWidth}
          itemCount={messages.length}
          itemSize={getItemSize}
          itemData={itemData}
          className="scrollbar-thin scrollbar-thumb-orange-300/20 scrollbar-track-transparent"
          estimatedItemSize={100}
        >
          {ListItem}
        </List>
      ) : (
        <div className="h-full w-full flex items-center justify-center">
          <Paragraph size="base" className="text-orange-300/70 font-mono">
            Loading messages...
          </Paragraph>
        </div>
      )}
    </div>
  );
};
