-- Migration: 002_add_indexes
-- Description: Add indexes for better performance
-- Created: 2024-01-02

CREATE INDEX idx_test_table_name ON test_table(name);
CREATE INDEX idx_test_table_created_at ON test_table(created_at);