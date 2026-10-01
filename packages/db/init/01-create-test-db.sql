-- Create the test database alongside the main one.
-- Docker entrypoint runs .sql files in /docker-entrypoint-initdb.d on first start.
CREATE DATABASE bidpilot_test;
