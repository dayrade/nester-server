-- Add Workflow Executions Table Migration
-- This script adds the missing workflow_executions table to the database
-- Copy and paste this into Supabase SQL Editor and run it

-- Create workflow execution status enum
DO $$ BEGIN
    CREATE TYPE workflow_status AS ENUM ('pending', 'running', 'completed', 'failed', 'retrying', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create workflow_executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_type TEXT NOT NULL,
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    
    -- Execution tracking
    status workflow_status DEFAULT 'pending',
    n8n_execution_id TEXT,
    n8n_workflow_id TEXT,
    
    -- Data
    input_data JSONB,
    output_data JSONB,
    n8n_data JSONB,
    error_message TEXT,
    
    -- Retry logic
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_retry_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_executions_agent_id ON workflow_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_property_id ON workflow_executions(property_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_type ON workflow_executions(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_at ON workflow_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_n8n_execution_id ON workflow_executions(n8n_execution_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_workflow_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_workflow_executions_updated_at_trigger ON workflow_executions;
CREATE TRIGGER update_workflow_executions_updated_at_trigger
    BEFORE UPDATE ON workflow_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_executions_updated_at();

-- Success message
SELECT 'Workflow executions table created successfully!' as message;