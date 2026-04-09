-- Schemas for each data domain
CREATE SCHEMA IF NOT EXISTS hr;
CREATE SCHEMA IF NOT EXISTS ecommerce;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS leetcode;

-- Read-only role for user query execution
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'coach_readonly') THEN
    CREATE ROLE coach_readonly WITH LOGIN PASSWORD 'readonly_local_dev';
  END IF;
END $$;

-- Grant usage on schemas
GRANT USAGE ON SCHEMA hr, ecommerce, analytics, leetcode, public TO coach_readonly;

-- Any table created by coach_admin in these schemas is auto-readable
ALTER DEFAULT PRIVILEGES FOR ROLE coach_admin IN SCHEMA hr GRANT SELECT ON TABLES TO coach_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE coach_admin IN SCHEMA ecommerce GRANT SELECT ON TABLES TO coach_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE coach_admin IN SCHEMA analytics GRANT SELECT ON TABLES TO coach_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE coach_admin IN SCHEMA leetcode GRANT SELECT ON TABLES TO coach_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE coach_admin IN SCHEMA public GRANT SELECT ON TABLES TO coach_readonly;

-- Prevent readonly from creating temp tables or modifying anything
REVOKE CREATE ON SCHEMA public FROM coach_readonly;
