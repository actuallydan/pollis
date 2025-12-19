import { create } from 'zustand';
import type { AppState, User, Group, Channel, Message, DMConversation, MessageQueueItem, NetworkStatus } from '../types';

interface AppStore extends AppState {
  // Actions
  setCurrentUser: (user: User | null) => void;
  setSelectedGroupId: (groupId: string | null) => void;
  setSelectedChannelId: (channelId: string | null) => void;
  setSelectedConversationId: (conversationId: string | null) => void;
  setGroups: (groups: Group[]) => void;
  addGroup: (group: Group) => void;
  setChannels: (groupId: string, channels: Channel[]) => void;
  addChannel: (channel: Channel) => void;
  setMessages: (key: string, messages: Message[]) => void;
  addMessage: (key: string, message: Message) => void;
  addMessagesBatch: (key: string, messages: Message[]) => void;
  updateMessage: (key: string, messageId: string, updates: Partial<Message>) => void;
  setDMConversations: (conversations: DMConversation[]) => void;
  addDMConversation: (conversation: DMConversation) => void;
  setNetworkStatus: (status: NetworkStatus) => void;
  setKillSwitchEnabled: (enabled: boolean) => void;
  setMessageQueue: (queue: MessageQueueItem[]) => void;
  addToMessageQueue: (item: MessageQueueItem) => void;
  updateMessageQueueItem: (id: string, updates: Partial<MessageQueueItem>) => void;
  removeFromMessageQueue: (id: string) => void;
  setReplyToMessageId: (messageId: string | null) => void;
  setShowThreadId: (threadId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  // Initial state
  currentUser: null,
  selectedGroupId: null,
  selectedChannelId: null,
  selectedConversationId: null,
  groups: [],
  channels: {},
  messages: {},
  dmConversations: [],
  networkStatus: 'offline',
  killSwitchEnabled: false,
  messageQueue: [],
  replyToMessageId: null,
  showThreadId: null,
  isLoading: false,
  error: null,

  // Actions
  setCurrentUser: (user) => set({ currentUser: user }),
  
  setSelectedGroupId: (groupId) => set({ selectedGroupId: groupId, selectedChannelId: null }),
  setSelectedChannelId: (channelId) => set({ selectedChannelId: channelId, selectedConversationId: null }),
  setSelectedConversationId: (conversationId) => set({ selectedConversationId: conversationId, selectedChannelId: null }),
  
  setGroups: (groups) => set({ groups }),
  addGroup: (group) => set((state) => ({ groups: [...state.groups, group] })),
  
  setChannels: (groupId, channels) => set((state) => ({
    channels: { ...state.channels, [groupId]: channels }
  })),
  addChannel: (channel) => set((state) => ({
    channels: {
      ...state.channels,
      [channel.group_id]: [...(state.channels[channel.group_id] || []), channel]
    }
  })),
  
  setMessages: (key, messages) => set((state) => ({
    messages: { ...state.messages, [key]: messages }
  })),
  addMessage: (key, message) => set((state) => ({
    messages: {
      ...state.messages,
      [key]: [...(state.messages[key] || []), message]
    }
  })),
  addMessagesBatch: (key, messages) => set((state) => {
    const current = state.messages[key] || [];
    // Merge and deduplicate by ID, then sort by timestamp
    const messageMap = new Map<string, Message>();
    current.forEach(msg => messageMap.set(msg.id, msg));
    messages.forEach(msg => messageMap.set(msg.id, msg));
    
    const merged = Array.from(messageMap.values())
      .sort((a, b) => a.timestamp - b.timestamp);
    
    return {
      messages: { ...state.messages, [key]: merged }
    };
  }),
  updateMessage: (key, messageId, updates) => set((state) => ({
    messages: {
      ...state.messages,
      [key]: (state.messages[key] || []).map((msg) =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    }
  })),
  
  setDMConversations: (conversations) => set({ dmConversations: conversations }),
  addDMConversation: (conversation) => set((state) => ({
    dmConversations: [...state.dmConversations, conversation]
  })),
  
  setNetworkStatus: (status) => set({ networkStatus: status }),
  setKillSwitchEnabled: (enabled) => set({ killSwitchEnabled: enabled }),
  
  setMessageQueue: (queue) => set({ messageQueue: queue }),
  addToMessageQueue: (item) => set((state) => ({
    messageQueue: [...state.messageQueue, item]
  })),
  updateMessageQueueItem: (id, updates) => set((state) => ({
    messageQueue: state.messageQueue.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    )
  })),
  removeFromMessageQueue: (id) => set((state) => ({
    messageQueue: state.messageQueue.filter((item) => item.id !== id)
  })),
  
  setReplyToMessageId: (messageId) => set({ replyToMessageId: messageId }),
  setShowThreadId: (threadId) => set({ showThreadId: threadId }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  logout: () => set({
    currentUser: null,
    selectedGroupId: null,
    selectedChannelId: null,
    selectedConversationId: null,
    groups: [],
    channels: {},
    messages: {},
    dmConversations: [],
    networkStatus: 'offline',
    killSwitchEnabled: false,
    messageQueue: [],
    replyToMessageId: null,
    showThreadId: null,
    isLoading: false,
    error: null,
  }),
}));

