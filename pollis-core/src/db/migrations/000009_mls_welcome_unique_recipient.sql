-- Welcome idempotency/dedupe (issue #430 P2). `mls_welcome` had only a per-row
-- ULID PK, so a re-sent Welcome for the same recipient/device stacked up as a
-- fresh duplicate row and the plain INSERT in the submit bundle could never be
-- made idempotent. This adds the UNIQUE tuple the ON CONFLICT upsert keys on:
-- one live Welcome per (conversation_id, recipient_id, recipient_device_id).
--
-- Additive/backward-compatible (CLAUDE.md migration constraint): a dedupe DELETE
-- + a new UNIQUE INDEX, no DROP of the table, no column/nullability change. The
-- previously-shipped app's plain INSERT keeps working — a duplicate now conflicts
-- instead of stacking, which the new client treats as the intended idempotent
-- resend.
--
-- Migration number: 000009 (000007 is a deliberately-skipped reverted number;
-- see 000008's header).

-- Prod rows may already contain duplicates, so collapse them FIRST — keep the
-- newest per tuple (MAX(id): ULIDs are time-ordered, so the lexicographically
-- greatest id is the most recent) — then the UNIQUE index can never fail on the
-- existing data. Rows with a NULL recipient_device_id are grouped together by
-- GROUP BY (SQL treats NULLs as equal for grouping), so a stray device-agnostic
-- Welcome is deduped too; the index itself does not constrain NULLs.
DELETE FROM mls_welcome
WHERE id NOT IN (
    SELECT MAX(id) FROM mls_welcome
    GROUP BY conversation_id, recipient_id, recipient_device_id
);

-- One live Welcome per (conversation_id, recipient_id, recipient_device_id),
-- enforced from here on. This is the conflict target the submit bundle's and the
-- /v1/welcomes/resubmit path's idempotent upserts key on.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mls_welcome_recipient
    ON mls_welcome (conversation_id, recipient_id, recipient_device_id);
