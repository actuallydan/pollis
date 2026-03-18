import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { useCreateOrGetDMConversation } from "../hooks/queries";
import { updateURL } from "../utils/urlRouting";

export const StartDM: React.FC = () => {
  const currentUser = useAppStore((state) => state.currentUser);
  const setSelectedConversationId = useAppStore(
    (state) => state.setSelectedConversationId
  );
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      updateURL(`/c/${conversation.id}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
      setIdentifier("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start conversation"
      );
    }
  };

  return (
    <div data-testid="start-dm-page">
      <button
        data-testid="start-dm-back-button"
        onClick={handleBack}
        aria-label="Back"
      >
        <ArrowLeft aria-hidden="true" />
        Back
      </button>

      <h1>Start Direct Message</h1>
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

        <button
          data-testid="start-dm-submit-button"
          type="submit"
          disabled={createDMMutation.isPending}
        >
          {createDMMutation.isPending ? "Starting..." : "Start Conversation"}
        </button>
      </form>
    </div>
  );
};
