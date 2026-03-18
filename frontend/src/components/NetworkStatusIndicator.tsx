import React from 'react';
import { Wifi, WifiOff, Shield } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export const NetworkStatusIndicator: React.FC = () => {
  const { networkStatus, killSwitchEnabled, toggleKillSwitch } = useNetworkStatus();

  const getStatusLabel = () => {
    switch (networkStatus) {
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      case 'kill-switch': return 'Kill Switch';
      default: return 'Unknown';
    }
  };

  const getIcon = () => {
    switch (networkStatus) {
      case 'online': return <Wifi aria-hidden="true" />;
      case 'offline': return <WifiOff aria-hidden="true" />;
      case 'kill-switch': return <Shield aria-hidden="true" />;
      default: return <WifiOff aria-hidden="true" />;
    }
  };

  return (
    <div data-testid="network-status">
      {getIcon()}
      <span data-testid="network-status-label">{getStatusLabel()}</span>
      <label>
        <input
          data-testid="kill-switch-toggle"
          type="checkbox"
          checked={killSwitchEnabled}
          onChange={(e) => toggleKillSwitch(e.target.checked)}
          aria-label="Kill switch"
        />
        kill-switch
      </label>
    </div>
  );
};
