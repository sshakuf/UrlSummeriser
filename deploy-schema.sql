-- Production database schema for URL Summarizer
-- Run this in your production Supabase SQL editor

-- Create urls table
CREATE TABLE IF NOT EXISTS urls (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    url TEXT NOT NULL,
    caption TEXT
);

-- Create prompts table
CREATE TABLE IF NOT EXISTS prompts (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    prompt_name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    description TEXT
);

-- Create url_summery table (note: keeping the typo for consistency)
CREATE TABLE IF NOT EXISTS url_summery (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    url_id BIGINT REFERENCES urls(id) ON DELETE CASCADE,
    prompt_id BIGINT REFERENCES prompts(id) ON DELETE CASCADE,
    scraped_data TEXT,
    ai_response TEXT
);

-- Insert sample prompts
INSERT INTO prompts (prompt_name, prompt, description) VALUES 
('General Summary', 'Please provide a concise summary of this webpage in 2-3 sentences, focusing on the main points and key information.', 'General purpose summary for any webpage'),
('Key Insights', 'Analyze this webpage and extract the top 3-5 key insights or takeaways. Present them as bullet points.', 'Focuses on extracting actionable insights'),
('Technical Analysis', 'Provide a technical analysis of this webpage, focusing on any technical concepts, methodologies, or implementations discussed.', 'Best for technical content and documentation'),
('Business Analysis', 'Analyze this webpage from a business perspective. What are the business implications, opportunities, or strategies mentioned?', 'Business-focused analysis for commercial content');

-- Enable Row Level Security (RLS) - Optional, remove if you want to keep it simple
-- ALTER TABLE urls ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE url_summery ENABLE ROW LEVEL SECURITY;

-- Create policies (optional - only if you enabled RLS above)
-- CREATE POLICY "Allow all operations for authenticated users" ON urls FOR ALL USING (true);
-- CREATE POLICY "Allow all operations for authenticated users" ON prompts FOR ALL USING (true);
-- CREATE POLICY "Allow all operations for authenticated users" ON url_summery FOR ALL USING (true);