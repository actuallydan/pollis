import React, { useMemo, useState } from "react";
import {
  Download,
  Upload,
  ShieldCheck,
  ShieldAlert,
  Lock,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card } from "../Card";
import { Header } from "../Header";
import { Paragraph } from "../Paragraph";
import { Button } from "../Button";
import { TextInput } from "../TextInput";
import { Badge } from "../Badge";
import { Switch } from "../Switch";

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
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
    "bg-emerald-500",
  ];
  return {
    score,
    label: labels[score],
    color: colors[score],
  };
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

  const exportStrength = useMemo(
    () => strength(exportPassword),
    [exportPassword]
  );
  const importStrength = useMemo(
    () => strength(importPassword),
    [importPassword]
  );

  return (
    <div className="space-y-4">
      <Card variant="bordered">
        <Header size="lg" className="mb-2 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Security Settings
        </Header>
        <Paragraph size="sm" className="text-orange-300/70">
          Manage your identity keys, backups, and verification settings.
        </Paragraph>
      </Card>

      <Card variant="bordered">
        <Header size="sm" className="mb-2">
          Your safety number
        </Header>
        <Paragraph size="sm" className="font-mono text-orange-300">
          {formatFingerprint(ownFingerprint)}
        </Paragraph>
      </Card>

      <Card variant="bordered">
        <Header size="sm" className="mb-2 flex items-center gap-2">
          Message previews
        </Header>
        <div className="flex items-center justify-between">
          <Paragraph size="sm" className="text-orange-300/70">
            Show decrypted previews in notifications (may leak on lock screen).
          </Paragraph>
          <Switch
            label=""
            checked={messagePreviewsEnabled}
            onChange={(val) => onToggleMessagePreviews?.(val)}
          />
        </div>
      </Card>

      <Card variant="bordered">
        <Header size="sm" className="mb-3 flex items-center gap-2">
          Encrypted backup
        </Header>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-3 border border-orange-300/20 rounded space-y-2">
            <Header size="sm">Export keys</Header>
            <TextInput
              label="Backup password"
              value={exportPassword}
              onChange={setExportPassword}
              type={showExportPassword ? "text" : "password"}
              placeholder="Strong unique password"
            />
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-orange-300/20 rounded">
                <div
                  className={`h-2 rounded ${exportStrength.color}`}
                  style={{ width: `${(exportStrength.score / 5) * 100}%` }}
                />
              </div>
              <Paragraph size="sm" className="text-orange-300/70">
                {exportStrength.label}
              </Paragraph>
              <button
                className="text-orange-300/70 hover:text-orange-300"
                type="button"
                onClick={() => setShowExportPassword((p) => !p)}
                aria-label="Toggle password visibility"
              >
                {showExportPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <Button
              icon={<Download className="w-4 h-4" />}
              onClick={() => onExportBackup?.(exportPassword)}
              disabled={exportStrength.score < 3}
            >
              Export encrypted backup
            </Button>
            <Paragraph size="sm" className="text-orange-300/60">
              Store the backup in a safe place. Losing it means losing access.
            </Paragraph>
          </div>

          <div className="p-3 border border-orange-300/20 rounded space-y-2">
            <Header size="sm">Import keys</Header>
            <TextInput
              label="Backup password"
              value={importPassword}
              onChange={setImportPassword}
              type={showImportPassword ? "text" : "password"}
              placeholder="Password used during export"
            />
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-orange-300/20 rounded">
                <div
                  className={`h-2 rounded ${importStrength.color}`}
                  style={{ width: `${(importStrength.score / 5) * 100}%` }}
                />
              </div>
              <Paragraph size="sm" className="text-orange-300/70">
                {importStrength.label}
              </Paragraph>
              <button
                className="text-orange-300/70 hover:text-orange-300"
                type="button"
                onClick={() => setShowImportPassword((p) => !p)}
                aria-label="Toggle password visibility"
              >
                {showImportPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <input
              type="file"
              accept=".json,.bak"
              onChange={(e) => setImportFile(e.target.files?.[0])}
              className="text-sm text-orange-300/80"
            />
            <Button
              icon={<Upload className="w-4 h-4" />}
              onClick={() => onImportBackup?.(importPassword, importFile)}
              disabled={!importFile || importStrength.score < 2}
            >
              Import backup
            </Button>
            <Paragraph size="sm" className="text-orange-300/60">
              Imports will replace your current identity keys. Use cautiously.
            </Paragraph>
          </div>
        </div>
      </Card>

      <Card variant="bordered">
        <Header size="sm" className="mb-2 flex items-center gap-2">
          Verified contacts
          <Badge variant="success" size="sm">
            {verifiedContacts.length}
          </Badge>
        </Header>
        {verifiedContacts.length === 0 ? (
          <Paragraph size="sm" className="text-orange-300/70">
            No verified contacts yet.
          </Paragraph>
        ) : (
          <div className="space-y-2">
            {verifiedContacts.map((c) => (
              <div
                key={c.id}
                className="p-2 border border-orange-300/20 rounded flex items-center justify-between"
              >
                <div>
                  <Paragraph size="sm" className="text-orange-300">
                    {c.name}
                  </Paragraph>
                  <Paragraph size="sm" className="text-orange-300/60 font-mono">
                    {formatFingerprint(c.fingerprint)}
                  </Paragraph>
                </div>
                <Badge
                  variant="success"
                  size="sm"
                  className="flex items-center gap-1"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Verified
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card variant="bordered">
        <Header size="sm" className="mb-2 flex items-center gap-2">
          Sessions
        </Header>
        {sessions.length === 0 ? (
          <Paragraph size="sm" className="text-orange-300/70">
            No active sessions.
          </Paragraph>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.sessionId}
                className="p-2 border border-orange-300/20 rounded flex items-center justify-between"
              >
                <div>
                  <Paragraph size="sm" className="text-orange-300">
                    {s.contactName}
                  </Paragraph>
                  <Paragraph size="sm" className="text-orange-300/60">
                    Session: {s.sessionId}
                  </Paragraph>
                  <Paragraph size="sm" className="text-orange-300/60">
                    Last ratchet: {new Date(s.lastRatchetAt).toLocaleString()}
                  </Paragraph>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      s.status === "active"
                        ? "success"
                        : s.status === "stale"
                        ? "warning"
                        : "error"
                    }
                    size="sm"
                  >
                    {s.status}
                  </Badge>
                  <Button
                    variant="secondary"
                    icon={<RefreshCw className="w-4 h-4" />}
                    onClick={() => onResetSession?.(s.sessionId)}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <Button variant="secondary" onClick={onClearSessions}>
            Clear all sessions
          </Button>
        </div>
      </Card>
    </div>
  );
};
