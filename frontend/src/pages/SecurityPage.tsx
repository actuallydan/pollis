import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PageShell } from "../components/Layout/PageShell";
import { Button } from "../components/ui/Button";
import { TextInput } from "../components/ui/TextInput";
import { useAppStore } from "../stores/appStore";
import * as api from "../services/api";

/// Human-readable summary for each `security_event.kind` the backend
/// currently emits. Unknown kinds fall through to the raw string so we
/// never silently drop new event types.
function describe(event: api.SecurityEvent): { heading: string; detail: string } {
  switch (event.kind) {
    case "device_enrolled":
      return {
        heading: "New device enrolled",
        detail: event.device_id
          ? `Device ${shortId(event.device_id)} was added to your account.`
          : "A new device was added to your account.",
      };
    case "device_rejected":
      return {
        heading: "Enrollment rejected",
        detail: event.device_id
          ? `A request from device ${shortId(event.device_id)} was rejected.`
          : "A device enrollment request was rejected.",
      };
    case "identity_reset":
      return {
        heading: "Account identity reset",
        detail:
          "You reset your account. All previous devices and groups were orphaned.",
      };
    case "secret_key_rotated":
      return {
        heading: "Secret Key rotated",
        detail: "Your Secret Key was changed. The old one no longer works.",
      };
    default:
      return {
        heading: event.kind,
        detail: event.metadata ?? "",
      };
  }
}

function shortId(id: string): string {
  if (id.length <= 10) {
    return id;
  }
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export const SecurityPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAppStore();
  const [events, setEvents] = useState<api.SecurityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [devices, setDevices] = useState<api.DeviceInfo[] | null>(null);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [confirmingDeviceId, setConfirmingDeviceId] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);

  const loadDevices = React.useCallback(() => {
    if (!currentUser) {
      return;
    }
    api
      .listUserDevices(currentUser.id)
      .then(setDevices)
      .catch((err) => {
        setDevicesError(err instanceof Error ? err.message : "Failed to load devices");
        setDevices([]);
      });
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    let cancelled = false;
    api
      .listSecurityEvents(currentUser.id)
      .then((rows) => {
        if (!cancelled) {
          setEvents(rows);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load security events");
          setEvents([]);
        }
      });
    loadDevices();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, loadDevices]);

  const startConfirm = (deviceId: string) => {
    setConfirmingDeviceId(deviceId);
    setConfirmInput("");
    setDevicesError(null);
  };

  const cancelConfirm = () => {
    setConfirmingDeviceId(null);
    setConfirmInput("");
  };

  const revoke = async (device: api.DeviceInfo) => {
    if (!currentUser) {
      return;
    }
    setRevokingDeviceId(device.device_id);
    setDevicesError(null);
    try {
      await api.revokeDevice(currentUser.id, device.device_id);
      cancelConfirm();
      loadDevices();
    } catch (err) {
      setDevicesError(err instanceof Error ? err.message : "Failed to revoke device");
    } finally {
      setRevokingDeviceId(null);
    }
  };

  return (
    <PageShell title="Security" scrollable>
      <div
        className="flex flex-col gap-4 p-4 font-mono"
        data-testid="security-page"
        style={{ color: "var(--c-text)" }}
      >
        <div>
          <h2 className="text-sm font-bold" style={{ color: "var(--c-accent)" }}>
            PIN
          </h2>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--c-text-muted)", lineHeight: 1.5 }}
          >
            The local PIN unlocks Pollis on this device. It never leaves
            the device and can't be recovered — use your Secret Key if
            you forget it.
          </p>
          <Button
            data-testid="change-pin-button"
            className="mt-3"
            onClick={() => navigate({ to: "/security/change-pin" })}
          >
            Change PIN
          </Button>
        </div>

        <div>
          <h2 className="text-sm font-bold" style={{ color: "var(--c-accent)" }}>
            Devices
          </h2>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--c-text-muted)", lineHeight: 1.5 }}
          >
            Every device signed in to your account. Revoke any you don't
            recognise — the device loses access to all groups and DMs on
            its next sync.
          </p>

          {devicesError && (
            <p
              data-testid="devices-error"
              className="text-xs mt-2"
              style={{ color: "#ff6b6b" }}
            >
              {devicesError}
            </p>
          )}

          {devices === null && (
            <p className="text-xs mt-2" style={{ color: "var(--c-text-muted)" }}>
              Loading…
            </p>
          )}

          {devices !== null && devices.length > 0 && (
            <ul className="flex flex-col gap-2 mt-3" data-testid="devices-list">
              {devices.map((device) => {
                const isConfirming = confirmingDeviceId === device.device_id;
                const isRevoking = revokingDeviceId === device.device_id;
                const displayName = device.device_name ?? shortId(device.device_id);
                return (
                  <li
                    key={device.device_id}
                    data-testid={`device-${device.device_id}`}
                    style={{
                      background: "var(--c-surface)",
                      border: "2px solid var(--c-border)",
                      borderRadius: "0.5rem",
                      padding: "0.75rem",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div
                          className="text-xs font-bold truncate"
                          style={{ color: "var(--c-text)" }}
                        >
                          {displayName}
                          {device.is_current && (
                            <span
                              className="ml-2 text-xs"
                              style={{ color: "var(--c-accent)" }}
                            >
                              (this device)
                            </span>
                          )}
                        </div>
                        <div
                          className="text-xs mt-1"
                          style={{ color: "var(--c-text-dim)" }}
                        >
                          Last seen {formatTimestamp(device.last_seen)}
                        </div>
                      </div>
                      {!device.is_current && !isConfirming && (
                        <Button
                          data-testid={`revoke-${device.device_id}`}
                          variant="secondary"
                          size="sm"
                          disabled={isRevoking}
                          onClick={() => startConfirm(device.device_id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>

                    {isConfirming && (
                      <div className="mt-3 flex flex-col gap-2">
                        <TextInput
                          label={`Type "${displayName}" to confirm`}
                          value={confirmInput}
                          onChange={setConfirmInput}
                          autoFocus
                          data-testid={`revoke-confirm-input-${device.device_id}`}
                        />
                        <div className="flex gap-2">
                          <Button
                            data-testid={`revoke-confirm-${device.device_id}`}
                            size="sm"
                            disabled={confirmInput !== displayName || isRevoking}
                            onClick={() => revoke(device)}
                          >
                            {isRevoking ? "Revoking…" : "Revoke device"}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isRevoking}
                            onClick={cancelConfirm}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-sm font-bold" style={{ color: "var(--c-accent)" }}>
            Security events
          </h2>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--c-text-muted)", lineHeight: 1.5 }}
          >
            Every time a device is added to your account, an enrollment is
            rejected, or your identity is reset, it shows up here. Check it
            if you ever suspect someone has accessed your account.
          </p>
        </div>

        {error && (
          <p
            data-testid="security-events-error"
            className="text-xs"
            style={{ color: "#ff6b6b" }}
          >
            {error}
          </p>
        )}

        {events === null && (
          <p className="text-xs" style={{ color: "var(--c-text-muted)" }}>
            Loading…
          </p>
        )}

        {events !== null && events.length === 0 && (
          <p
            data-testid="security-events-empty"
            className="text-xs"
            style={{ color: "var(--c-text-muted)" }}
          >
            No security events recorded yet.
          </p>
        )}

        {events !== null && events.length > 0 && (
          <ul className="flex flex-col gap-3" data-testid="security-events-list">
            {events.map((event) => {
              const { heading, detail } = describe(event);
              return (
                <li
                  key={event.id}
                  data-testid={`security-event-${event.id}`}
                  style={{
                    background: "var(--c-surface)",
                    border: "2px solid var(--c-border)",
                    borderRadius: "0.5rem",
                    padding: "0.75rem",
                  }}
                >
                  <div
                    className="text-xs font-bold"
                    style={{ color: "var(--c-text)" }}
                  >
                    {heading}
                  </div>
                  <div
                    className="text-xs mt-1"
                    style={{ color: "var(--c-text-muted)" }}
                  >
                    {detail}
                  </div>
                  <div
                    className="text-xs mt-2"
                    style={{ color: "var(--c-text-dim)" }}
                  >
                    {formatTimestamp(event.created_at)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageShell>
  );
};
