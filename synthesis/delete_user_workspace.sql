-- Usage:
--   1. Open this file in Neon SQL Editor.
--   2. Replace 'replace-me@example.com' below with the test account email.
--   3. Run the script.
--
-- Safety:
-- - Deletes the entire organization/workspace for the target email.
-- - Refuses to run if the organization has more than one user.
-- - Intended for test accounts only.

BEGIN;

DO $$
DECLARE
    v_email text := lower(trim('replace-me@example.com'));
    v_user_id uuid;
    v_org_id uuid;
    v_org_name text;
    v_org_user_count integer;
BEGIN
    IF v_email IS NULL OR v_email = '' OR v_email = 'replace-me@example.com' THEN
        RAISE EXCEPTION 'Edit v_email first and replace replace-me@example.com with the target test account email.';
    END IF;

    SELECT u.id, u.organization_id, o.name
    INTO v_user_id, v_org_id, v_org_name
    FROM users u
    JOIN organizations o ON o.id = u.organization_id
    WHERE lower(u.email) = v_email;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No user found for email: %', v_email;
    END IF;

    SELECT count(*)
    INTO v_org_user_count
    FROM users
    WHERE organization_id = v_org_id;

    IF v_org_user_count <> 1 THEN
        RAISE EXCEPTION
            'Refusing to delete organization % (%) because it contains % users. Remove this guard only if you intentionally want to wipe a shared workspace.',
            v_org_id,
            v_org_name,
            v_org_user_count;
    END IF;

    RAISE NOTICE 'Deleting workspace for email %, org % (%)', v_email, v_org_id, v_org_name;

    -- Clear references that would otherwise block deletes.
    UPDATE signals
    SET trigger_id = NULL,
        ingested_event_id = NULL,
        event_buffer_id = NULL
    WHERE organization_id = v_org_id;

    UPDATE ingested_events
    SET signal_id = NULL
    WHERE organization_id = v_org_id;

    UPDATE event_buffers
    SET synthesis_run_id = NULL
    WHERE organization_id = v_org_id;

    UPDATE feature_requests
    SET merged_into_id = NULL
    WHERE organization_id = v_org_id;

    -- User-scoped data.
    DELETE FROM refresh_tokens
    WHERE user_id IN (
        SELECT id
        FROM users
        WHERE organization_id = v_org_id
    );

    -- Organization-scoped data.
    DELETE FROM api_keys WHERE organization_id = v_org_id;
    DELETE FROM agent_messages
    WHERE conversation_id IN (
        SELECT id
        FROM agent_conversations
        WHERE organization_id = v_org_id
    );
    DELETE FROM agent_conversations WHERE organization_id = v_org_id;
    DELETE FROM agent_jobs WHERE organization_id = v_org_id;
    DELETE FROM code_chunks WHERE organization_id = v_org_id;
    DELETE FROM code_index_status WHERE organization_id = v_org_id;
    DELETE FROM feature_request_signals
    WHERE feature_request_id IN (
        SELECT id
        FROM feature_requests
        WHERE organization_id = v_org_id
    )
    OR signal_id IN (
        SELECT id
        FROM signals
        WHERE organization_id = v_org_id
    );
    DELETE FROM feature_requests WHERE organization_id = v_org_id;
    DELETE FROM synthesis_runs WHERE organization_id = v_org_id;
    DELETE FROM signals WHERE organization_id = v_org_id;
    DELETE FROM ingestion_jobs WHERE organization_id = v_org_id;
    DELETE FROM webhook_subscriptions WHERE organization_id = v_org_id;
    DELETE FROM ingested_events WHERE organization_id = v_org_id;
    DELETE FROM event_buffers WHERE organization_id = v_org_id;
    DELETE FROM triggers WHERE organization_id = v_org_id;
    DELETE FROM connectors WHERE organization_id = v_org_id;
    DELETE FROM users WHERE organization_id = v_org_id;
    DELETE FROM organizations WHERE id = v_org_id;

    IF EXISTS (
        SELECT 1
        FROM users
        WHERE id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Cleanup failed; user % still exists after delete', v_user_id;
    END IF;

    RAISE NOTICE 'Workspace delete completed for %', v_email;
END
$$;

COMMIT;
