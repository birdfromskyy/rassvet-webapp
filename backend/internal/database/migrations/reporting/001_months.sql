-- No attempt to split legacy full_name or invent dates/months/actual counts.
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_name varchar(80) NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name varchar(80) NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS middle_name varchar(80) NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE students ADD COLUMN IF NOT EXISTS identity_revision bigint NOT NULL DEFAULT 1;
ALTER TABLE students ADD CONSTRAINT student_identity_revision_positive CHECK (identity_revision > 0);

CREATE TABLE legal_representatives (
 id bigserial PRIMARY KEY,
 user_id bigint REFERENCES users(id) ON DELETE SET NULL,
 last_name varchar(80) NOT NULL CHECK (btrim(last_name) <> ''),
 first_name varchar(80) NOT NULL CHECK (btrim(first_name) <> ''),
 middle_name varchar(80) NOT NULL DEFAULT '', birth_date date,
 is_active boolean NOT NULL DEFAULT true,
 revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
 created_by bigint REFERENCES users(id) ON DELETE SET NULL,
 updated_by bigint REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_legal_representatives_user ON legal_representatives(user_id);
CREATE INDEX idx_legal_representatives_name ON legal_representatives(last_name, first_name, middle_name, id);

CREATE TABLE student_legal_representatives (
 id bigserial PRIMARY KEY,
 student_id bigint NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
 legal_representative_id bigint NOT NULL REFERENCES legal_representatives(id) ON DELETE RESTRICT,
 relationship varchar(80) NOT NULL CHECK (btrim(relationship) <> ''),
 valid_from date, valid_until date,
 revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
 created_by bigint REFERENCES users(id) ON DELETE SET NULL,
 updated_by bigint REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(student_id, legal_representative_id), CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);
CREATE INDEX idx_student_legal_rep_person ON student_legal_representatives(legal_representative_id);

CREATE TABLE social_service_report_settings (
 id bigint PRIMARY KEY CHECK (id = 1), contract_number varchar(100) NOT NULL DEFAULT '', contract_date date,
 revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
 updated_by bigint REFERENCES users(id) ON DELETE SET NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO social_service_report_settings(id) VALUES (1);

CREATE TABLE student_service_months (
 id bigserial PRIMARY KEY, student_id bigint NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
 month date NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
 representative_id bigint,
 status varchar(16) NOT NULL CHECK (status IN ('draft','finalized')),
 revision bigint NOT NULL CHECK (revision > 0), snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
 creation_key varchar(128) NOT NULL, creation_hash varchar(64) NOT NULL,
 created_by bigint REFERENCES users(id) ON DELETE SET NULL,
 updated_by bigint REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(student_id, month), UNIQUE(student_id, creation_key),
 FOREIGN KEY(student_id, representative_id) REFERENCES student_legal_representatives(student_id, legal_representative_id) ON DELETE RESTRICT
);
CREATE INDEX idx_service_month_period ON student_service_months(month, status, student_id);
CREATE INDEX idx_service_month_representative ON student_service_months(student_id, representative_id);

CREATE TABLE student_service_month_items (
 id bigserial PRIMARY KEY, month_id bigint NOT NULL REFERENCES student_service_months(id) ON DELETE RESTRICT,
 social_service_id bigint NOT NULL REFERENCES social_services(id) ON DELETE RESTRICT,
 code varchar(32) NOT NULL CHECK (btrim(code) <> ''), name text NOT NULL CHECK (btrim(name) <> ''),
 category varchar(255) NOT NULL CHECK (btrim(category) <> ''), sort_order integer NOT NULL,
 periodicity varchar(255) NOT NULL CHECK (btrim(periodicity) <> ''),
 frequency_count integer, frequency_unit varchar(16) NOT NULL,
 maximum_monthly_count integer NOT NULL CHECK (maximum_monthly_count BETWEEN 0 AND 100000),
 actual_monthly_count integer CHECK (actual_monthly_count BETWEEN 0 AND maximum_monthly_count),
 standard_duration_minutes integer NOT NULL CHECK (standard_duration_minutes BETWEEN 1 AND 1440),
 tariff_kopecks bigint NOT NULL CHECK (tariff_kopecks BETWEEN 0 AND 100000000),
 UNIQUE(month_id, social_service_id),
 CHECK ((frequency_unit = 'manual' AND frequency_count IS NULL) OR
        (frequency_unit IN ('day','week','month') AND frequency_count IS NOT NULL AND frequency_count BETWEEN 1 AND 100000)),
 CHECK (frequency_unit = 'manual' OR maximum_monthly_count = frequency_count *
        CASE frequency_unit WHEN 'day' THEN 31 WHEN 'week' THEN 4 ELSE 1 END)
);
CREATE INDEX idx_service_month_item_service ON student_service_month_items(social_service_id);

CREATE TABLE student_service_month_revisions (
 id bigserial PRIMARY KEY, month_id bigint NOT NULL REFERENCES student_service_months(id) ON DELETE RESTRICT,
 revision bigint NOT NULL CHECK (revision > 0), action varchar(32) NOT NULL,
 data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
 created_by bigint REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(month_id, revision)
);
CREATE FUNCTION protect_service_month_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'reporting revisions are immutable' USING ERRCODE = '23514'; END; $$;
CREATE TRIGGER service_month_revision_immutable BEFORE UPDATE OR DELETE ON student_service_month_revisions
 FOR EACH ROW EXECUTE FUNCTION protect_service_month_revision();

CREATE TABLE social_service_legacy_migrations (
 student_id bigint PRIMARY KEY REFERENCES students(id) ON DELETE RESTRICT,
 month_id bigint NOT NULL UNIQUE REFERENCES student_service_months(id) ON DELETE RESTRICT,
 include_actual boolean NOT NULL,
 created_by bigint REFERENCES users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);

-- Both old writes and cutover lock the same student first. This closes the
-- race where a request started before the child moved to monthly reporting.
CREATE FUNCTION guard_legacy_student_services() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE child_id bigint;
BEGIN
 IF TG_OP = 'DELETE' THEN child_id := OLD.student_id; ELSE child_id := NEW.student_id; END IF;
 IF TG_OP = 'UPDATE' AND NEW.student_id <> OLD.student_id THEN
  RAISE EXCEPTION 'changing legacy student is not supported' USING ERRCODE = '23514';
 END IF;
 PERFORM id FROM students WHERE id = child_id FOR UPDATE;
 IF EXISTS (SELECT 1 FROM student_service_months WHERE student_id = child_id) THEN
  RAISE EXCEPTION 'student uses monthly services; legacy set is read-only' USING ERRCODE = '23514';
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;
CREATE TRIGGER legacy_student_services_readonly BEFORE INSERT OR UPDATE OR DELETE ON student_social_services
 FOR EACH ROW EXECUTE FUNCTION guard_legacy_student_services();
