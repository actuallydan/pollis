import React, { useMemo, useState } from "react";
import {
  Download,
  Upload,
  ShieldCheck,
  Lock,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";

export interface VerifiedContact {
  id: string;
  name: string;
  fingerprint: string;
  verifiedAt: number;
}

export interface SessionInfo {
  contactId: string;
  contactName: string;
  sessionId: string;
  lastRatchetAt: number;
  status: "active" | "stale" | "warning";
}

interface SecuritySettingsProps {
  ownFingerprint: string;
  verifiedContacts?: VerifiedContact[];
  sessions?: SessionInfo[];
  messagePreviewsEnabled?: boolean;
  onToggleMessagePreviews?: (enabled: boolean) => void;
  onExportBackup?: (password: string) => void;
  onImportBackup?: (password: string, file?: File) => void;
  onClearSessions?: () => void;
  onResetSession?: (sessionId: string) => void;
}

const formatFingerprint = (fp: string) => (fp.match(/.{1,5}/g) || []).join(" ");

const strength = (password: string) => {
  let score = 0;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong", "Excellent"];
  return { score, label: labels[score] };
};

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  ownFingerprint,
  verifiedContacts = [],
  sessions = [],
  messagePreviewsEnabled = false,
  onToggleMessagePreviews,
  onExportBackup,
  onImportBackup,
  onClearSessions,
  onResetSession,
}) => {
  const [exportPassword, setExportPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importFile, setImportFile] = useState<File | undefined>(undefined);
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [showImportPassword, setShowImportPassword] = useState(false);

  const exportStrength = useMemo(() => strength(exportPassword), [exportPassword]);
  const importStrength = useMemo(() => strength(importPassword), [importPassword]);

  return (
    <div data-testid="security-settings">
      <div>
        <h1>
          <Lock aria-hidden="true" />
          Security Settings
        </h1>
        <p>Manage your identity keys, backups, and verification settings.</p>
      </div>

      <div>
        <h3>Your safety number</h3>
        <p>{formatFingerprint(ownFingerprint)}</p>
      </div>

      <div>
        <h3>Message previews</h3>
        <div>
          <p>Show decrypted previews in notifications (may leak on lock screen).</p>
          <label>
            <input
              data-testid="message-previews-toggle"
              type="checkbox"
              checked={messagePreviewsEnabled}
              onChange={(e) => onToggleMessagePreviews?.(e.target.checked)}
            />
            Enable
          </label>
        </div>
      </div>

      <div>
        <h3>Encrypted backup</h3>
        <div>
          <div>
            <h3>Export keys</h3>
            <label htmlFor="export-password">Backup password</label>
            <div>
              <input
                id="export-password"
                data-testid="export-password-input"
                type={showExportPassword ? "text" : "password"}
                value={exportPassword}
                onChange={(e) => setExportPassword(e.target.value)}
                placeholder="Strong unique password"
              />
              <button
                type="button"
                onClick={() => setShowExportPassword((p) => !p)}
                aria-label="Toggle password visibility"
              >
                {showExportPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
            <p>{exportStrength.label}</p>
            <button
              data-testid="export-backup-button"
              onClick={() => onExportBackup?.(exportPassword)}
              disabled={exportStrength.score < 3}
            >
              <Download aria-hidden="true" />
              Export encrypted backup
            </button>
            <p>Store the backup in a safe place. Losing it means losing access.</p>
          </div>

          <div>
            <h3>Import keys</h3>
            <label htmlFor="import-password">Backup password</label>
            <div>
              <input
                id="import-password"
                data-testid="import-password-input"
                type={showImportPassword ? "text" : "password"}
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                placeholder="Password used during export"
              />
              <button
                type="button"
                onClick={() => setShowImportPassword((p) => !p)}
                aria-label="Toggle password visibility"
              >
                {showImportPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
            <p>{importStrength.label}</p>
            <input
              data-testid="import-backup-file-input"
              type="file"
              accept=".json,.bak"
              onChange={(e) => setImportFile(e.target.files?.[0])}
              aria-label="Select backup file"
            />
            <button
              data-testid="import-backup-button"
              onClick={() => onImportBackup?.(importPassword, importFile)}
              disabled={!importFile || importStrength.score < 2}
            >
              <Upload aria-hidden="true" />
              Import backup
            </button>
            <p>Imports will replace your current identity keys. Use cautiously.</p>
          </div>
        </div>
      </div>

      <div>
        <h3>
          Verified contacts
          <span>{verifiedContacts.length}</span>
        </h3>
        {verifiedContacts.length === 0 ? (
          <p>No verified contacts yet.</p>
        ) : (
          <div>
            {verifiedContacts.map((c) => (
              <div key={c.id} data-testid={`verified-contact-${c.id}`}>
                <div>
                  <p>{c.name}</p>
                  <p>{formatFingerprint(c.fingerprint)}</p>
                </div>
                <span>
                  <ShieldCheck aria-hidden="true" />
                  Verified
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3>Sessions</h3>
        {sessions.length === 0 ? (
          <p>No active sessions.</p>
        ) : (
          <div>
            {sessions.map((s) => (
              <div key={s.sessionId} data-testid={`session-${s.sessionId}`}>
                <div>
                  <p>{s.contactName}</p>
                  <p>Session: {s.sessionId}</p>
                  <p>Last ratchet: {new Date(s.lastRatchetAt).toLocaleString()}</p>
                </div>
                <div>
                  <span>{s.status}</span>
                  <button
                    data-testid={`reset-session-${s.sessionId}`}
                    onClick={() => onResetSession?.(s.sessionId)}
                  >
                    <RefreshCw aria-hidden="true" />
                    Reset
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div>
          <button
            data-testid="clear-all-sessions-button"
            onClick={onClearSessions}
          >
            Clear all sessions
          </button>
        </div>
      </div>
    </div>
  );
};
