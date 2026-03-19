import React, { useState } from "react";
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
    <div
      data-testid="start-dm-page"
      className="flex-1 flex flex-col overflow-auto"
      style={{ background: 'var(--c-bg)' }}
    >
      <div className="flex-1 flex justify-center overflow-auto px-6 py-8">
        <form
          data-testid="start-dm-form"
          onSubmit={handleSubmit}
          className="w-full max-w-md flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dm-identifier" className="section-label px-0">Username or Email</label>
            <input
              id="dm-identifier"
              data-testid="dm-identifier-input"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="username, email, or phone"
              required
              disabled={createDMMutation.isPending}
              className="pollis-input"
            />
          </div>

          {(error || createDMMutation.error) && (
            <p data-testid="start-dm-error" className="text-xs font-mono" style={{ color: '#ff6b6b' }}>
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
            className="btn-primary self-start py-2"
          >
            {createDMMutation.isPending ? "Starting…" : "Start Conversation"}
          </button>
        </form>
      </div>
    </div>
  );
};
