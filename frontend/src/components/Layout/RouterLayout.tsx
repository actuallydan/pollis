import React, { useEffect } from 'react';
import { Outlet, useRouter } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { useAppStore } from '../../stores/appStore';
import { useUserGroups, useGroupChannels, useDMConversations } from '../../hooks/queries';

interface RouterLayoutProps {
  onLogout: () => void;
}

export const RouterLayout: React.FC<RouterLayoutProps> = ({ onLogout }) => {
  const router = useRouter();
  const { selectedGroupId, setGroups, setChannels, setDMConversations } = useAppStore();

  // Fetch and sync groups
  const { data: groups } = useUserGroups();
  useEffect(() => {
    if (groups) {
      setGroups(groups);
    }
  }, [groups, setGroups]);

  // Fetch and sync channels for selected group
  const { data: channels } = useGroupChannels(selectedGroupId);
  useEffect(() => {
    if (channels && selectedGroupId) {
      setChannels(selectedGroupId, channels);
    }
  }, [channels, selectedGroupId, setChannels]);

  // Fetch and sync DM conversations
  const { data: dmConversations } = useDMConversations();
  useEffect(() => {
    if (dmConversations) {
      setDMConversations(dmConversations);
    }
  }, [dmConversations, setDMConversations]);

  const handleCreateGroup = () => {
    router.navigate({ to: '/create-group' });
  };

  const handleCreateChannel = () => {
    router.navigate({ to: '/create-channel' });
  };

  const handleSearchGroup = () => {
    router.navigate({ to: '/search-group' });
  };

  const handleStartDM = () => {
    router.navigate({ to: '/start-dm' });
  };

  return (
    <div className="flex-1 flex overflow-hidden min-h-0">
      <Sidebar
        onCreateGroup={handleCreateGroup}
        onCreateChannel={handleCreateChannel}
        onSearchGroup={handleSearchGroup}
        onStartDM={handleStartDM}
        onLogout={onLogout}
      />
      <Outlet />
    </div>
  );
};
