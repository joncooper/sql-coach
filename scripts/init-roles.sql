-- Schemas for the core data domains
CREATE SCHEMA IF NOT EXISTS hr;
CREATE SCHEMA IF NOT EXISTS ecommerce;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Read-only role for user query execution
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'coach_readonly') THEN
    CREATE ROLE coach_readonly WITH LOGIN PASSWORD 'readonly_local_dev';
  END IF;
END $$;

-- Grant usage on all existing schemas to readonly
DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO coach_readonly', s);
  END LOOP;
END $$;

-- Any table created by coach_admin in ANY schema is auto-readable by coach_readonly
ALTER DEFAULT PRIVILEGES FOR ROLE coach_admin GRANT SELECT ON TABLES TO coach_readonly;

-- Prevent readonly from creating temp tables or modifying anything
REVOKE CREATE ON SCHEMA public FROM coach_readonly;
