import React from "react";
import { ShieldAlert, ShieldCheck, XCircle } from "lucide-react";

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
    <div data-testid="key-change-warning">
      <ShieldAlert aria-hidden="true" />
      <div>
        <h3>
          Identity key changed for {contactName}
          <span>Re-verify required</span>
        </h3>
        <p>
          This could mean a reinstall or a new device. Verify the new safety
          number with {contactName} before continuing.
        </p>

        <div>
          {oldFingerprint && (
            <div>
              <p>Previous fingerprint</p>
              <p>{formatFingerprint(oldFingerprint)}</p>
            </div>
          )}
          <div>
            <p>New fingerprint</p>
            <p>{formatFingerprint(newFingerprint)}</p>
          </div>
        </div>

        <div>
          <button data-testid="reverify-button" onClick={onReverify}>
            <ShieldCheck aria-hidden="true" />
            Re-verify now
          </button>
          <button data-testid="continue-anyway-button" onClick={onContinue}>
            Continue anyway
          </button>
          <button data-testid="cancel-key-warning-button" onClick={onCancel}>
            <XCircle aria-hidden="true" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
