import React from "react";
import { ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { Card, Header, Paragraph, Button, Badge } from "monopollis";

interface KeyChangeWarningProps {
  contactName: string;
  oldFingerprint?: string;
  newFingerprint: string;
  onReverify?: () => void;
  onContinue?: () => void;
  onCancel?: () => void;
}

const formatFingerprint = (fp?: string) =>
  fp ? (fp.match(/.{1,5}/g) || []).join(" ") : "Unknown";

export const KeyChangeWarning: React.FC<KeyChangeWarningProps> = ({
  contactName,
  oldFingerprint,
  newFingerprint,
  onReverify,
  onContinue,
  onCancel,
}) => {
  return (
    <Card variant="bordered" className="bg-red-900/10 border-red-300/40">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-6 h-6 text-red-300 mt-0.5" />
        <div className="flex-1">
          <Header size="sm" className="text-red-200 flex items-center gap-2">
            Identity key changed for {contactName}
            <Badge variant="warning" size="sm">
              Re-verify required
            </Badge>
          </Header>
          <Paragraph size="sm" className="text-orange-200/80 mt-1">
            This could mean a reinstall or a new device. Verify the new safety
            number with {contactName} before continuing.
          </Paragraph>

          <div className="mt-3 grid md:grid-cols-2 gap-3">
            {oldFingerprint && (
              <div className="p-2 border border-orange-300/20 rounded">
                <Paragraph size="sm" className="text-orange-300/80 mb-1">
                  Previous fingerprint
                </Paragraph>
                <Paragraph size="sm" className="font-mono text-orange-300">
                  {formatFingerprint(oldFingerprint)}
                </Paragraph>
              </div>
            )}
            <div className="p-2 border border-orange-300/20 rounded">
              <Paragraph size="sm" className="text-orange-300/80 mb-1">
                New fingerprint
              </Paragraph>
              <Paragraph size="sm" className="font-mono text-orange-300">
                {formatFingerprint(newFingerprint)}
              </Paragraph>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={onReverify}
              icon={<ShieldCheck className="w-4 h-4" />}
              className="flex-1"
            >
              Re-verify now
            </Button>
            <Button variant="secondary" onClick={onContinue} className="flex-1">
              Continue anyway
            </Button>
            <Button
              variant="secondary"
              onClick={onCancel}
              className="flex-1"
              icon={<XCircle className="w-4 h-4" />}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
