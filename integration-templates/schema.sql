-- Reference migration. PostgreSQL runtime integration must be verified by Codex.
-- UUIDs are generated in Node using crypto.randomUUID(); no extension is required.
BEGIN;
CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE users (
 id uuid PRIMARY KEY, email text NOT NULL UNIQUE CHECK(email=lower(email)), display_name text NOT NULL,
 password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workspaces (
 id uuid PRIMARY KEY, owner_user_id uuid NOT NULL UNIQUE REFERENCES users(id),
 name text NOT NULL DEFAULT 'Assessment sandbox', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 token_hash char(64) PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE policies (
 id text PRIMARY KEY, title text NOT NULL, body text NOT NULL, source_file text NOT NULL,
 source_page integer NOT NULL CHECK(source_page>0), source_section text NOT NULL,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english',coalesce(title,'')||' '||body)) STORED
);
CREATE INDEX policies_search_idx ON policies USING gin(search_vector);
CREATE TABLE cases (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id), source_id text NOT NULL,
 source_kind text NOT NULL CHECK(source_kind IN ('request','ticket','custom')),
 source_snapshot jsonb NOT NULL, source_status text, source_date date,
 employee_name text, employee_email text, original_text text NOT NULL,
 work_state text NOT NULL, active boolean NOT NULL, facts jsonb NOT NULL DEFAULT '{}'::jsonb,
 fact_evidence jsonb NOT NULL DEFAULT '[]'::jsonb, last_decision jsonb,
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,source_id)
);
CREATE INDEX cases_workspace_state_idx ON cases(workspace_id,work_state);
CREATE TABLE runs (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, case_id uuid NOT NULL,
 idempotency_key text NOT NULL, input_hash char(64) NOT NULL,
 status text NOT NULL CHECK(status IN ('RUNNING','COMPLETED','FAILED','INTERRUPTED','CONFLICTED')),
 agent_mode text CHECK(agent_mode IN ('gemini','offline','offline-fallback')),
 case_version integer NOT NULL, result jsonb, safe_error_code text,
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 FOREIGN KEY(workspace_id,case_id) REFERENCES cases(workspace_id,id),
 UNIQUE(workspace_id,id), UNIQUE(workspace_id,idempotency_key)
);
CREATE UNIQUE INDEX one_running_run_per_case ON runs(workspace_id,case_id) WHERE status='RUNNING';
CREATE TABLE messages (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, case_id uuid NOT NULL, run_id uuid,
 role text NOT NULL CHECK(role IN ('user','assistant','source')),
 content text NOT NULL CHECK(length(content)<=12000), metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,case_id) REFERENCES cases(workspace_id,id),
 FOREIGN KEY(workspace_id,run_id) REFERENCES runs(workspace_id,id),
 UNIQUE(run_id,role)
);
CREATE INDEX messages_case_idx ON messages(workspace_id,case_id,created_at,id);
CREATE TABLE service_tickets (
 id uuid PRIMARY KEY, workspace_id uuid NOT NULL, case_id uuid NOT NULL,
 display_id text NOT NULL, route text, state text NOT NULL,
 original_status text, summary text NOT NULL, reason_code text,
 policy_source_ids jsonb NOT NULL DEFAULT '[]'::jsonb, history_source_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,case_id) REFERENCES cases(workspace_id,id),
 UNIQUE(workspace_id,case_id), UNIQUE(workspace_id,display_id)
);
CREATE TABLE audit_events (
 sequence_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id uuid NOT NULL UNIQUE, workspace_id uuid NOT NULL REFERENCES workspaces(id), case_id uuid, run_id uuid,
 actor_user_id uuid REFERENCES users(id), event_type text NOT NULL, node_name text,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb, occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,case_id) REFERENCES cases(workspace_id,id),
 FOREIGN KEY(workspace_id,run_id) REFERENCES runs(workspace_id,id)
);
CREATE INDEX audit_workspace_sequence_idx ON audit_events(workspace_id,sequence_id);
CREATE FUNCTION deny_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Audit records are append-only';
END;
$$;
CREATE TRIGGER audit_no_update_delete BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();
INSERT INTO schema_migrations(version) VALUES('001_initial');
COMMIT;
