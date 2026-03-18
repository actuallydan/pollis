import React, { useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { useCreateOrGetDMConversation } from "../../hooks/queries";

interface StartDMModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StartDMModal: React.FC<StartDMModalProps> = ({
  isOpen,
  onClose,
}) => {
  const currentUser = useAppStore((state) => state.currentUser);
  const setSelectedConversationId = useAppStore(
    (state) => state.setSelectedConversationId
  );
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createDMMutation = useCreateOrGetDMConversation();

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("User identifier is required");
      return;
    }
    if (!currentUser) {
      setError("User not found");
      return;
    }
    setError(null);
    try {
      const conversation = await createDMMutation.mutateAsync(identifier.trim());
      setSelectedConversationId(conversation.id);
      onClose();
      setIdentifier("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start conversation"
      );
    }
  };

  return (
    <div data-testid="start-dm-modal">
      <button
        data-testid="close-start-dm-modal-button"
        onClick={onClose}
        aria-label="Close"
      >
        <X aria-hidden="true" />
      </button>

      <h2>Start Direct Message</h2>
      <p>Enter a username, email, or phone number to start a conversation.</p>

      <form data-testid="start-dm-form" onSubmit={handleSubmit}>
        <label htmlFor="dm-identifier">User Identifier</label>
        <input
          id="dm-identifier"
          data-testid="dm-identifier-input"
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="username, email, or phone"
          required
          disabled={createDMMutation.isPending}
        />
        <p>Username, email address, or phone number</p>

        {(error || createDMMutation.error) && (
          <p data-testid="start-dm-error">
            {error ||
              (createDMMutation.error instanceof Error
                ? createDMMutation.error.message
                : "Failed to start conversation")}
          </p>
        )}

        <div>
          <button
            data-testid="cancel-start-dm-button"
            type="button"
            onClick={onClose}
            disabled={createDMMutation.isPending}
          >
            Cancel
          </button>
          <button
            data-testid="submit-start-dm-button"
            type="submit"
            disabled={createDMMutation.isPending}
          >
            {createDMMutation.isPending ? "Starting..." : "Start Conversation"}
          </button>
        </div>
      </form>
    </div>
  );
};
