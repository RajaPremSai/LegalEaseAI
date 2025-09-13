-- Migration: 001_test
-- Description: Test migration for unit tests
-- Created: 2024-01-01

CREATE TABLE test_table (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);