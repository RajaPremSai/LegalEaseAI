-- Template Library Migration
-- Creates tables for document templates, annotations, clauses, and comparisons

-- Document templates table
CREATE TABLE document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('contract', 'lease', 'terms_of_service', 'privacy_policy', 'loan_agreement', 'employment', 'nda', 'other')),
    industry TEXT[] NOT NULL DEFAULT '{}',
    jurisdiction TEXT[] NOT NULL DEFAULT '{}',
    template_content TEXT NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    download_count INTEGER DEFAULT 0,
    rating DECIMAL(2,1) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
    review_count INTEGER DEFAULT 0
);

-- Template annotations table
CREATE TABLE template_annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
    start_index INTEGER NOT NULL,
    end_index INTEGER NOT NULL,
    page_number INTEGER,
    annotation_type VARCHAR(20) NOT NULL CHECK (annotation_type IN ('explanation', 'warning', 'customization', 'alternative')),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    importance VARCHAR(10) NOT NULL CHECK (importance IN ('high', 'medium', 'low'))
);

-- Standard clauses table
CREATE TABLE standard_clauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('payment', 'termination', 'liability', 'intellectual_property', 'confidentiality', 'dispute_resolution', 'other')),
    is_required BOOLEAN DEFAULT false,
    explanation TEXT NOT NULL,
    risk_level VARCHAR(10) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high'))
);

-- Clause alternatives table
CREATE TABLE clause_alternatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clause_id UUID NOT NULL REFERENCES standard_clauses(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    description TEXT NOT NULL,
    favorability VARCHAR(15) NOT NULL CHECK (favorability IN ('favorable', 'neutral', 'unfavorable')),
    use_case VARCHAR(300) NOT NULL
);

-- Customization options table
CREATE TABLE customization_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(15) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'multiselect', 'boolean')),
    label VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    required BOOLEAN DEFAULT false,
    default_value JSONB,
    options TEXT[],
    validation JSONB
);

-- Template comparisons table
CREATE TABLE template_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES document_templates(id),
    user_document_id UUID NOT NULL REFERENCES documents(id),
    overall_compliance INTEGER NOT NULL CHECK (overall_compliance >= 0 AND overall_compliance <= 100),
    comparison_result JSONB NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template usage tracking table
CREATE TABLE template_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES document_templates(id),
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(20) NOT NULL CHECK (action IN ('view', 'download', 'customize', 'compare')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_document_templates_category ON document_templates(category);
CREATE INDEX idx_document_templates_industry ON document_templates USING GIN(industry);
CREATE INDEX idx_document_templates_jurisdiction ON document_templates USING GIN(jurisdiction);
CREATE INDEX idx_document_templates_active ON document_templates(is_active) WHERE is_active = true;
CREATE INDEX idx_template_annotations_template_id ON template_annotations(template_id);
CREATE INDEX idx_standard_clauses_template_id ON standard_clauses(template_id);
CREATE INDEX idx_clause_alternatives_clause_id ON clause_alternatives(clause_id);
CREATE INDEX idx_customization_options_template_id ON customization_options(template_id);
CREATE INDEX idx_template_comparisons_template_id ON template_comparisons(template_id);
CREATE INDEX idx_template_comparisons_document_id ON template_comparisons(user_document_id);
CREATE INDEX idx_template_usage_template_id ON template_usage(template_id);
CREATE INDEX idx_template_usage_user_id ON template_usage(user_id);

-- Update trigger for template updated_at
CREATE OR REPLACE FUNCTION update_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_template_updated_at
    BEFORE UPDATE ON document_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_template_updated_at();