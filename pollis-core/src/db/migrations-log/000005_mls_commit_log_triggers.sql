-- Schema-layer enforcement of invariant I1 — the commit log is a gapless,
-- append-only, single-writer-per-epoch chain (issue #691, phase 1 of
-- docs/backend-core-invariants.md).
--
-- IMPORTANT: COMMIT-LOG-DB migration (mls_commit_log lives on the SEPARATE log
-- DB post-#420). Applied by desktop-release.yml's second db-apply step
-- (MIGRATIONS_DIR=pollis-core/src/db/migrations-log). It must NOT go in the
-- main-DB dir. This is migration 000005 of the log DB's OWN sequence (the log DB
-- started its numbering at 000001; do not confuse it with the main DB, whose
-- 000007 is a permanent hole — see docs/goal-a-deploy-runbook.md).
--
-- WHY. Until now no TRIGGER existed anywhere in the schema. I1 was held ONLY by
-- the compare-and-swap INSERT in `pollis-delivery::commit::submit_commit` — the
-- protocol layer. A bug in our own DS code could therefore still open a gap in
-- the chain, rewrite an applied commit, or delete the live head, and nothing in
-- the database would stop it. "Invalid states unrepresentable" wants the
-- invariant enforced at the LOWEST layer (DB > type > protocol > discipline);
-- these triggers are that lowest layer. They are a SECOND line of defence behind
-- the CAS, never a replacement for it — the CAS still picks the single winner
-- per epoch race-free; the triggers make a gap/rewrite/head-loss physically
-- impossible even if the CAS were bypassed or buggy.
--
-- COEXISTENCE WITH RETENTION (the "must not fire on legitimate traffic" bar).
-- The DS legitimately DELETEs from this table in exactly two shapes, both from
-- `commit.rs` and both a PREFIX/whole-lineage removal that NEVER touches the
-- live head (the floor is clamped to `head - 1`, #681, and to `head_generation`):
--   * `delete_commits_below`  — `epoch < floor` within the head generation;
--   * `delete_generations_below` — whole CLOSED generations (`generation < floor`).
-- The DELETE trigger below is written so neither can ever trip it (proof in the
-- per-trigger comments and in pollis-delivery/tests/commit_log_triggers.rs), and
-- the whole integration suite runs the real submit + prune path against this
-- triggered schema (POST_BASELINE_LOG_MIGRATIONS).
--
-- Additive/backward-compatible (CLAUDE.md migration rule): three CREATE TRIGGER
-- statements only — no table/column/index change, nothing an existing row or a
-- shipped read-only client can violate. `IF NOT EXISTS` makes re-apply a no-op.

-- 1. FORWARD-GAP GUARD (kills F1). A commit may only be appended at the head of
-- its lineage: `NEW.epoch` must be <= the current head (`MAX(epoch)+1`) within
-- `(conversation_id, generation)`. A forward jump (`epoch > head`) is what left
-- ELECTRON epochs 4/5/11 missing and wedged `ants`. This is exactly the CAS's
-- forward-gap rejection, restated as a schema invariant.
--   * The head insert (`epoch = MAX(epoch)+1`) passes (`epoch = head`, not `>`).
--   * A racing/stale resubmit at `epoch <= MAX(epoch)` passes the trigger and is
--     absorbed by the CAS's `ON CONFLICT(conversation_id, generation, epoch) DO
--     NOTHING` — the trigger does not interfere with dedup.
--   * The opening commit of a new generation (`epoch = 0`, empty lineage) passes:
--     the subquery is scoped to `NEW.generation`, whose MAX is NULL → head 0.
-- So the ONLY thing it rejects is a forward gap, which no legitimate submit ever
-- produces (the CAS's WHERE only ever emits a row at `epoch = head`).
CREATE TRIGGER IF NOT EXISTS trg_mls_commit_log_no_forward_gap
BEFORE INSERT ON mls_commit_log
FOR EACH ROW
WHEN NEW.epoch > (
    SELECT COALESCE(MAX(epoch), -1) + 1
    FROM mls_commit_log
    WHERE conversation_id = NEW.conversation_id
      AND generation = NEW.generation
)
BEGIN
    SELECT RAISE(ABORT, 'mls_commit_log I1: epoch skips ahead of the head (forward gap)');
END;

-- 2. IMMUTABLE HISTORY (kills the rewrite half of F2). The chain identity
-- (`conversation_id`, `generation`, `epoch`) and the committed payload
-- (`commit_data`) can never be changed once written — a stored commit is
-- final. The DS never issues an UPDATE to this table at all (grep: the only
-- writes in commit.rs are the CAS INSERT and the two retention DELETEs), so this
-- has ZERO legitimate traffic to fire on; it exists purely so a future stray
-- UPDATE cannot silently re-point or edit applied history.
CREATE TRIGGER IF NOT EXISTS trg_mls_commit_log_immutable
BEFORE UPDATE ON mls_commit_log
FOR EACH ROW
WHEN NEW.conversation_id <> OLD.conversation_id
  OR NEW.generation <> OLD.generation
  OR NEW.epoch <> OLD.epoch
  OR NEW.commit_data <> OLD.commit_data
BEGIN
    SELECT RAISE(ABORT, 'mls_commit_log I1: commit history is immutable');
END;

-- 3. HEAD PROTECTION (kills the catastrophic half of F2). The live head commit —
-- MAX(epoch) of MAX(generation) for a conversation — may never be deleted. That
-- is the deletion that actually wedges a group (the F2 symptom: "dan applied
-- epoch 11, it was deleted, ants wedged" — every current member is now stranded
-- and must external-join). Legitimate retention NEVER hits this row:
--   * `delete_commits_below` deletes `epoch < floor` with `floor <= head - 1`
--     (#681 clamp) within the head generation, so every deleted epoch is strictly
--     below the head epoch — the second WHEN term is false for all of them.
--   * `delete_generations_below` deletes only `generation < head_generation`, so
--     the first WHEN term (`OLD.generation = MAX(generation)`) is false for all of
--     them; the head generation's MAX(generation) is invariant under that delete.
-- Because the head is invariant under BOTH legitimate delete shapes, the guard is
-- order-independent: it cannot false-positive partway through a bulk prefix/
-- generation prune regardless of the engine's row-visit order. It fires ONLY when
-- code (a bug, a manual query) tries to remove the current head, which is never a
-- legitimate operation.
--
-- NOTE (scope, honest): this guard protects the HEAD, not against an interior
-- hole punched into the retained window `[floor, head)`. A per-row BEFORE DELETE
-- trigger cannot detect an interior gap without inspecting sibling rows, and any
-- sibling-based rule false-positives on the legitimate bulk prefix delete under
-- some engine row-visit orders (an intermediate state of a prefix truncation is
-- indistinguishable from a mid-chain hole). Interior contiguity therefore stays
-- enforced by the CAS + the clamped retention floor in Rust; the schema layer
-- guarantees no forward gap, no rewrite, and no head loss — the three that
-- actually wedge a group.
--
-- CONSEQUENCE (deliberate, not an oversight — full-conversation erasure): with
-- the head guard in place there is NO order in which every commit row of a
-- conversation can be deleted. Prune bottom-up and the last remaining row IS the
-- head (aborts); delete the head first and it aborts immediately. Nothing does
-- this today — the only DELETEs are the two retention shapes above, neither of
-- which ever empties a live conversation — so this is not a regression. But a
-- future "delete my account / erase this conversation" path (this launch epic
-- will need one) must NOT discover the wall by hitting a RAISE(ABORT) in prod: an
-- erasure path has to lift the guard for the scope of its own transaction — e.g.
-- `DROP TRIGGER trg_mls_commit_log_keep_head; DELETE ...; <recreate>` inside one
-- transaction, or a narrowly scoped exemption. Building that is a separate ticket;
-- this migration only records that the constraint is intentional. See I1 in
-- docs/backend-core-invariants.md and .codesight/wiki/database.md.
CREATE TRIGGER IF NOT EXISTS trg_mls_commit_log_keep_head
BEFORE DELETE ON mls_commit_log
FOR EACH ROW
WHEN OLD.generation = (
        SELECT MAX(generation) FROM mls_commit_log
        WHERE conversation_id = OLD.conversation_id
     )
 AND OLD.epoch = (
        SELECT MAX(epoch) FROM mls_commit_log
        WHERE conversation_id = OLD.conversation_id
          AND generation = OLD.generation
     )
BEGIN
    SELECT RAISE(ABORT, 'mls_commit_log I1: the live head commit cannot be deleted');
END;
