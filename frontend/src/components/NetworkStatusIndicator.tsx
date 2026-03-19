import React from 'react';
import { Wifi, WifiOff, Shield } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const ICON_SIZE = 13;

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

  const iconColor = networkStatus === 'online'
    ? 'var(--c-accent)'
    : networkStatus === 'kill-switch'
    ? '#f0b429'
    : '#ff6b6b';

  return (
    <div
      data-testid="network-status"
      className="flex items-center gap-2"
    >
      <span style={{ color: iconColor, display: 'flex', alignItems: 'center' }}>
        {networkStatus === 'online'  && <Wifi    size={ICON_SIZE} aria-hidden="true" />}
        {networkStatus === 'offline' && <WifiOff size={ICON_SIZE} aria-hidden="true" />}
        {networkStatus === 'kill-switch' && <Shield size={ICON_SIZE} aria-hidden="true" />}
        {networkStatus !== 'online' && networkStatus !== 'offline' && networkStatus !== 'kill-switch' && (
          <WifiOff size={ICON_SIZE} aria-hidden="true" />
        )}
      </span>
      <span
        data-testid="network-status-label"
        className="text-2xs font-mono"
        style={{ color: iconColor }}
      >
        {getStatusLabel()}
      </span>
      <label
        className="flex items-center gap-1 cursor-pointer"
        title="Kill switch — block all network traffic"
      >
        <input
          data-testid="kill-switch-toggle"
          type="checkbox"
          checked={killSwitchEnabled}
          onChange={(e) => toggleKillSwitch(e.target.checked)}
          aria-label="Kill switch"
          className="w-3 h-3 accent-current"
          style={{ accentColor: 'var(--c-accent)' }}
        />
        <span className="text-2xs font-mono" style={{ color: 'var(--c-text-muted)' }}>kill-sw</span>
      </label>
    </div>
  );
};
