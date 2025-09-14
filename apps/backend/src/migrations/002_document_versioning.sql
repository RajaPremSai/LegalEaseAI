-- Migration for document versioning and comparison features

-- Create document_versions table
CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    version_number INTEGER NOT NULL,
    filename VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL,
    analysis JSONB,
    parent_version_id UUID REFERENCES document_versions(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure unique version numbers per document
    UNIQUE(document_id, version_number)
);

-- Create document_comparisons table
CREATE TABLE IF NOT EXISTS document_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    compared_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    compared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    changes JSONB NOT NULL,
    impact_analysis JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure we don't duplicate comparisons
    UNIQUE(original_version_id, compared_version_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_version_number ON document_versions(document_id, version_number);
CREATE INDEX IF NOT EXISTS idx_document_versions_uploaded_at ON document_versions(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_document_versions_parent ON document_versions(parent_version_id);

CREATE INDEX IF NOT EXISTS idx_document_comparisons_original ON document_comparisons(original_version_id);
CREATE INDEX IF NOT EXISTS idx_document_comparisons_compared ON document_comparisons(compared_version_id);
CREATE INDEX IF NOT EXISTS idx_document_comparisons_compared_at ON document_comparisons(compared_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_document_versions_updated_at 
    BEFORE UPDATE ON document_versions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE document_versions IS 'Stores different versions of documents for comparison and history tracking';
COMMENT ON TABLE document_comparisons IS 'Stores comparison results between document versions';

COMMENT ON COLUMN document_versions.version_number IS 'Sequential version number starting from 1';
COMMENT ON COLUMN document_versions.parent_version_id IS 'Reference to the previous version this was based on';
COMMENT ON COLUMN document_comparisons.changes IS 'JSON array of detected changes between versions';
COMMENT ON COLUMN document_comparisons.impact_analysis IS 'JSON object containing impact analysis of the changes';