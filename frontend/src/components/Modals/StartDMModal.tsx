import React, { useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { Card } from "../Card";
import { Button } from "../Button";
import { TextInput } from "../TextInput";
import { Header } from "../Header";
import { Paragraph } from "../Paragraph";
import { CreateOrGetDMConversation } from "../../../wailsjs/go/main/App";

interface StartDMModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StartDMModal: React.FC<StartDMModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, addDMConversation, setSelectedConversationId } =
    useAppStore();
  const [identifier, setIdentifier] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setIsLoading(true);
    setError(null);

    try {
      const conversation = await CreateOrGetDMConversation(
        currentUser.id,
        identifier.trim()
      );

      // Convert to our DMConversation type
      const conversationData: any = {
        id: conversation.id,
        user1_id: conversation.user1_id,
        user2_identifier: conversation.user2_identifier,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
      };

      addDMConversation(conversationData);
      setSelectedConversationId(conversationData.id);
      onClose();

      // Reset form
      setIdentifier("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start conversation"
      );
    } finally {
      setIsLoading(false);
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
            disabled={isLoading}
            description="Username, email address, or phone number"
          />

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-300/30 rounded">
              <Paragraph size="sm" className="text-red-300">
                {error}
              </Paragraph>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
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
