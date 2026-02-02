import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { Button, TextInput, Header, Paragraph } from "monopollis";
import { useCreateOrGetDMConversation } from "../hooks/queries";
import { updateURL } from "../utils/urlRouting";

export const StartDM: React.FC = () => {
  const currentUser = useAppStore((state) => state.currentUser);
  const setSelectedConversationId = useAppStore(
    (state) => state.setSelectedConversationId
  );
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Use React Query mutation for creating/getting DM conversation
  const createDMMutation = useCreateOrGetDMConversation();

  const handleBack = () => {
    window.history.back();
  };

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

      // Navigate to the conversation
      updateURL(`/c/${conversation.id}`);
      window.dispatchEvent(new PopStateEvent("popstate"));

      // Reset form
      setIdentifier("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start conversation"
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-black overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto p-8">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-orange-300/70 hover:text-orange-300 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <Header size="xl" className="mb-2">
            Start Direct Message
          </Header>
          <Paragraph size="base" className="mb-8 text-orange-300/70">
            Enter a username, email, or phone number to start a conversation.
          </Paragraph>

          <form onSubmit={handleSubmit} className="space-y-6">
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
              <div className="p-4 bg-red-900/20 border border-red-300/30 rounded">
                <Paragraph size="sm" className="text-red-300">
                  {error ||
                    (createDMMutation.error instanceof Error
                      ? createDMMutation.error.message
                      : "Failed to start conversation")}
                </Paragraph>
              </div>
            )}

            <Button
              type="submit"
              isLoading={createDMMutation.isPending}
              loadingText="Starting..."
              className="w-full"
            >
              Start Conversation
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
