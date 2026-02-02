import React, { useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { Card, Button, TextInput, Header, Paragraph } from "monopollis";
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

  // Use React Query mutation for creating/getting DM conversation
  const createDMMutation = useCreateOrGetDMConversation();

  if (!isOpen) return null;

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

      // Reset form
      setIdentifier("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start conversation"
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md relative" variant="bordered">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-orange-300/70 hover:text-orange-300 hover:bg-orange-300/10 rounded transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <Header size="lg" className="mb-2 pr-8">
          Start Direct Message
        </Header>
        <Paragraph size="sm" className="mb-6 text-orange-300/70">
          Enter a username, email, or phone number to start a conversation.
        </Paragraph>

        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput
            id="identifier"
            label="User Identifier"
            value={identifier}
            onChange={setIdentifier}
            placeholder="username, email, or phone"
            required
            disabled={createDMMutation.isPending}
            description="Username, email address, or phone number"
          />

          {(error || createDMMutation.error) && (
            <div className="p-3 bg-red-900/20 border border-red-300/30 rounded">
              <Paragraph size="sm" className="text-red-300">
                {error ||
                  (createDMMutation.error instanceof Error
                    ? createDMMutation.error.message
                    : "Failed to start conversation")}
              </Paragraph>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={createDMMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createDMMutation.isPending}
              loadingText="Starting..."
              className="flex-1"
            >
              Start Conversation
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
