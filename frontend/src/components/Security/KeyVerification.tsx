import React, { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { Card, Header, Paragraph, Button, TextInput, Badge } from "monopollis";

interface KeyVerificationProps {
  contactName: string;
  contactId?: string;
  localFingerprint: string;
  remoteFingerprint: string;
  keyChanged?: boolean;
  onVerified?: (contactId?: string) => void;
  onCancel?: () => void;
}

const formatSafetyNumber = (fingerprint: string): string[] => {
  return (
    fingerprint
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .match(/.{1,5}/g) || []
  );
};

export const KeyVerification: React.FC<KeyVerificationProps> = ({
  contactName,
  contactId,
  localFingerprint,
  remoteFingerprint,
  keyChanged = false,
  onVerified,
  onCancel,
}) => {
  const [manualEntry, setManualEntry] = useState("");
  const [copied, setCopied] = useState(false);

  const remoteGroups = useMemo(
    () => formatSafetyNumber(remoteFingerprint),
    [remoteFingerprint]
  );
  const localGroups = useMemo(
    () => formatSafetyNumber(localFingerprint),
    [localFingerprint]
  );

  const matches =
    formatSafetyNumber(manualEntry).join("") ===
    formatSafetyNumber(remoteFingerprint).join("");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(remoteFingerprint);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy fingerprint", error);
    }
  };

  return (
    <Card variant="bordered" className="w-full max-w-3xl bg-black">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Header size="lg" className="mb-1">
            Verify {contactName}
          </Header>
          <Paragraph size="sm" className="text-orange-300/70">
            Compare safety numbers or scan QR to verify the contact&apos;s
            identity.
          </Paragraph>
        </div>
        {keyChanged && (
          <Badge
            variant="warning"
            size="sm"
            className="flex items-center gap-1"
          >
            <ShieldAlert className="w-4 h-4" />
            Key changed
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="p-3 border border-orange-300/20 rounded">
          <Header size="sm" className="mb-2 flex items-center gap-2">
            Your safety number
            <Badge variant="default" size="sm">
              You
            </Badge>
          </Header>
          <div className="flex flex-wrap gap-1 font-mono text-sm text-orange-300">
            {localGroups.map((g, idx) => (
              <span
                key={`local-${idx}`}
                className="px-2 py-1 bg-orange-300/10 border border-orange-300/20 rounded"
              >
                {g}
              </span>
            ))}
          </div>
        </div>

        <div className="p-3 border border-orange-300/20 rounded">
          <Header size="sm" className="mb-2 flex items-center gap-2">
            {contactName}&apos;s safety number
            {keyChanged ? (
              <Badge variant="warning" size="sm">
                Needs verification
              </Badge>
            ) : (
              <Badge variant="success" size="sm">
                Current
              </Badge>
            )}
          </Header>
          <div className="flex flex-wrap gap-1 font-mono text-sm text-orange-300">
            {remoteGroups.map((g, idx) => (
              <span
                key={`remote-${idx}`}
                className="px-2 py-1 bg-orange-300/10 border border-orange-300/20 rounded"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3 border border-orange-300/20 rounded flex items-center justify-center bg-orange-300/5">
          <div className="text-center space-y-2">
            <QRCodeSVG
              value={`pollis-verification:${remoteFingerprint}`}
              size={160}
              bgColor="#000000"
              fgColor="#fdba74"
              includeMargin
            />
            <Paragraph size="sm" className="text-orange-300/70">
              Scan to verify out-of-band
            </Paragraph>
            <Button
              variant="secondary"
              onClick={handleCopy}
              icon={
                copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )
              }
              className="w-full"
            >
              {copied ? "Copied" : "Copy safety number"}
            </Button>
          </div>
        </div>

        <div className="p-3 border border-orange-300/20 rounded space-y-3">
          <Header size="sm" className="mb-1">
            Manual comparison
          </Header>
          <TextInput
            label="Enter the safety number you see on their device"
            value={manualEntry}
            onChange={setManualEntry}
            placeholder="ABCDE FGHIJ ..."
          />
          <div className="flex items-center gap-2">
            {matches ? (
              <Badge
                variant="success"
                size="sm"
                className="flex items-center gap-1"
              >
                <ShieldCheck className="w-4 h-4" />
                Matches
              </Badge>
            ) : (
              <Badge
                variant="warning"
                size="sm"
                className="flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Not verified
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => onVerified?.(contactId)}
              disabled={!matches}
              className="flex-1"
              icon={<ShieldCheck className="w-4 h-4" />}
            >
              Mark as verified
            </Button>
            <Button
              variant="secondary"
              onClick={onCancel}
              className="flex-1"
              icon={<X className="w-4 h-4" />}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
