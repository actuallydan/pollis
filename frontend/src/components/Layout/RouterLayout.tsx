import React from 'react';
import { Outlet, useRouter } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';

interface RouterLayoutProps {
  onLogout: () => void;
}

export const RouterLayout: React.FC<RouterLayoutProps> = ({ onLogout }) => {
  const router = useRouter();

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
