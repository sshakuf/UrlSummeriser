import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "../lib/supabase";

interface UrlRecord {
  id: number;
  created_at: string;
  url: string;
  caption: string;
}

interface UrlSummary {
  id: number;
  url_id: number;
  prompt_id: number;
  scraped_data: string;
  ai_response: string;
  created_at: string;
  prompts?: {
    prompt_name: string;
    description: string;
  };
}

interface ProcessResult {
  success: boolean;
  url_id: number;
  url: string;
  original_caption: string;
  scraped_text_length: number;
  ai_response: string;
  prompt_used: string;
  model: string;
}

interface Prompt {
  id: number;
  prompt_name: string;
  prompt: string;
  description: string;
}

export interface UrlListRef {
  refreshUrls: () => void;
}

const UrlList = forwardRef<UrlListRef>((props, ref) => {
  const [urls, setUrls] = useState<UrlRecord[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [summaries, setSummaries] = useState<UrlSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [results, setResults] = useState<ProcessResult | null>(null);
  const [selectedPrompts, setSelectedPrompts] = useState<{[key: number]: number}>({});
  const [error, setError] = useState("");

  // Fetch URLs from database
  const fetchUrls = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("urls")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setUrls(data || []);
    } catch (err: any) {
      setError(`Failed to fetch URLs: ${err.message}`);
      console.error("Error fetching URLs:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch prompts from database
  const fetchPrompts = async () => {
    try {
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .order("prompt_name", { ascending: true });

      if (error) {
        throw error;
      }

      setPrompts(data || []);
      // Auto-select first prompt for all URLs if available
      if (data && data.length > 0) {
        const firstPromptId = data[0].id;
        setSelectedPrompts(prev => {
          const newSelected = { ...prev };
          urls.forEach(url => {
            if (!newSelected[url.id]) {
              newSelected[url.id] = firstPromptId;
            }
          });
          return newSelected;
        });
      }
    } catch (err: any) {
      setError(`Failed to fetch prompts: ${err.message}`);
      console.error("Error fetching prompts:", err);
    }
  };

  // Process URL with ChatGPT
  const processUrl = async (urlId: number) => {
    try {
      const selectedPromptId = selectedPrompts[urlId];
      if (!selectedPromptId) {
        setError("Please select a prompt for this URL first");
        return;
      }

      setProcessingId(urlId);
      setError("");
      setResults(null);

      const { data, error: functionError } = await supabase.functions.invoke(
        "process-url",
        {
          body: {
            url_id: urlId,
            prompt_id: selectedPromptId,
          },
        }
      );

      if (functionError) {
        throw functionError;
      }

      setResults(data);
      // Refresh summaries after processing
      fetchSummaries();
    } catch (err: any) {
      setError(`Failed to process URL: ${err.message}`);
      console.error("Error processing URL:", err);
    } finally {
      setProcessingId(null);
    }
  };

  // Fetch summaries from database
  const fetchSummaries = async () => {
    try {
      const { data, error } = await supabase
        .from("url_summery")
        .select(`
          *,
          prompts (
            prompt_name,
            description
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setSummaries(data || []);
    } catch (err: any) {
      setError(`Failed to fetch summaries: ${err.message}`);
      console.error("Error fetching summaries:", err);
    }
  };

  // Expose refresh function to parent via ref
  useImperativeHandle(ref, () => ({
    refreshUrls: () => {
      fetchUrls();
      fetchSummaries();
    }
  }));

  // Load URLs, prompts, and summaries on component mount
  useEffect(() => {
    fetchUrls();
    fetchPrompts();
    fetchSummaries();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const truncateUrl = (url: string, maxLength: number = 50) => {
    return url.length > maxLength ? `${url.substring(0, maxLength)}...` : url;
  };

  return (
    <div className="url-list-container">
      <div className="header-section">
        <h2>Saved URLs</h2>
        <button
          onClick={fetchUrls}
          disabled={loading}
          className="refresh-button"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>


      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      )}

      {loading ? (
        <div className="loading">
          <p>Loading URLs...</p>
        </div>
      ) : urls.length === 0 ? (
        <div className="no-urls">
          <p>No URLs found. Add some URLs first using the form above.</p>
        </div>
      ) : (
        <div className="urls-grid">
          {urls.map((urlRecord) => {
            const urlSummaries = summaries.filter(s => s.url_id === urlRecord.id);
            const hasSummary = urlSummaries.length > 0;
            
            return (
              <div key={urlRecord.id} className="url-card">
                {/* Top section with prompt selector and analyze button */}
                <div className="url-card-header">
                  <div className="url-prompt-section">
                    <select
                      value={selectedPrompts[urlRecord.id] || ""}
                      onChange={(e) => setSelectedPrompts(prev => ({
                        ...prev,
                        [urlRecord.id]: e.target.value ? Number(e.target.value) : 0
                      }))}
                      className="url-prompt-select"
                    >
                      <option value="">Choose prompt...</option>
                      {prompts.map((prompt) => (
                        <option key={prompt.id} value={prompt.id}>
                          {prompt.prompt_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => processUrl(urlRecord.id)}
                    disabled={processingId === urlRecord.id || !selectedPrompts[urlRecord.id]}
                    className="analyze-button"
                  >
                    {processingId === urlRecord.id ? "Analyzing..." : "Analyze"}
                  </button>
                </div>

                {/* URL info section - smaller and less prominent */}
                <div className="url-meta">
                  <a
                    href={urlRecord.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="url-link-small"
                    title={urlRecord.url}
                  >
                    {truncateUrl(urlRecord.url, 60)}
                  </a>
                  <span className="url-date-small">
                    Added: {formatDate(urlRecord.created_at)}
                  </span>
                </div>

                {/* Summary section - prominent if exists */}
                {hasSummary ? (
                  <div className="summaries-section">
                    <h3>AI Analysis Results:</h3>
                    {urlSummaries.map((summary) => (
                      <div key={summary.id} className="summary-item">
                        <div className="summary-header">
                          <span className="prompt-name">{summary.prompts?.prompt_name || 'Unknown Prompt'}</span>
                          <span className="summary-date">{formatDate(summary.created_at)}</span>
                        </div>
                        <div className="ai-response-display">
                          {summary.ai_response}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-summary">
                    <p>No AI analysis yet. Select a prompt and click "Analyze" to get started.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="results-section">
          <h3>AI Processing Results</h3>
          <div className="result-card">
            <div className="result-header">
              <span>
                <strong>URL ID:</strong> {results.url_id}
              </span>
              <span>
                <strong>Model:</strong> {results.model}
              </span>
            </div>

            <div className="result-url">
              <strong>Processed URL:</strong>
              <a href={results.url} target="_blank" rel="noopener noreferrer">
                {results.url}
              </a>
            </div>

            <div className="result-stats">
              <span>
                <strong>Text Length:</strong> {results.scraped_text_length}{" "}
                characters
              </span>
              <span>
                <strong>Original Caption:</strong> {results.original_caption}
              </span>
            </div>

            <div className="result-prompt">
              <strong>Prompt Used:</strong>
              <p className="prompt-text">{results.prompt_used}</p>
            </div>

            <div className="ai-response">
              <strong>AI Response:</strong>
              <textarea
                value={results.ai_response}
                readOnly
                className="response-textbox"
                rows={8}
              />
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .url-list-container {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          color: white;
        }

        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .header-section h2 {
          margin: 0;
          color: #333;
        }

        .refresh-button {
          padding: 8px 16px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .refresh-button:hover:not(:disabled) {
          background-color: #0056b3;
        }

        .refresh-button:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }

        .prompt-section {
          margin-bottom: 20px;
          padding: 15px;
          background-color: rgba(255, 255, 255, 0.05);
          border: 1px solid #61dafb;
          border-radius: 8px;
        }

        .prompt-section label {
          display: block;
          margin-bottom: 8px;
          font-weight: bold;
          color: #61dafb;
        }

        .prompt-select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
          background-color: rgba(255, 255, 255, 0.9);
          color: #282c34;
        }

        .prompt-preview {
          margin-top: 15px;
          padding: 15px;
          background-color: rgba(255, 255, 255, 0.08);
          border: 1px solid #61dafb;
          border-radius: 4px;
        }

        .prompt-preview p {
          margin: 8px 0;
          font-size: 14px;
          line-height: 1.4;
        }

        .error-message {
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
          color: #721c24;
          padding: 10px;
          border-radius: 4px;
          margin-bottom: 20px;
        }

        .loading,
        .no-urls {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .urls-grid {
          display: grid;
          gap: 20px;
          margin-bottom: 30px;
        }

        .url-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #61dafb;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .url-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 15px;
          padding-bottom: 15px;
          border-bottom: 1px solid rgba(97, 218, 251, 0.2);
        }

        .url-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 12px;
          color: #666;
        }

        .url-link {
          margin-bottom: 8px;
        }

        .url-link a {
          color: #007bff;
          text-decoration: none;
          font-weight: 500;
        }

        .url-link a:hover {
          text-decoration: underline;
        }

        .url-caption {
          font-size: 14px;
          color: #e0e0e0;
          line-height: 1.4;
        }

        .url-prompt-section {
          flex: 1;
        }

        .url-prompt-select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
          background-color: rgba(255, 255, 255, 0.9);
          color: #282c34;
          box-sizing: border-box;
        }

        .analyze-button {
          padding: 8px 16px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          white-space: nowrap;
        }

        .analyze-button:hover:not(:disabled) {
          background-color: #0056b3;
        }

        .analyze-button:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }

        .url-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          font-size: 12px;
          color: #a0a0a0;
        }

        .url-link-small {
          color: #61dafb;
          text-decoration: none;
          font-size: 12px;
        }

        .url-link-small:hover {
          text-decoration: underline;
        }

        .url-date-small {
          font-size: 11px;
          color: #888;
        }

        .summaries-section {
          margin-top: 20px;
        }

        .summaries-section h3 {
          color: #61dafb;
          font-size: 16px;
          margin-bottom: 15px;
          margin-top: 0;
        }

        .summary-item {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(97, 218, 251, 0.3);
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 15px;
        }

        .summary-item:last-child {
          margin-bottom: 0;
        }

        .summary-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .prompt-name {
          font-weight: bold;
          color: #98fb98;
          font-size: 14px;
        }

        .summary-date {
          font-size: 11px;
          color: #888;
        }

        .ai-response-display {
          color: #e0e0e0;
          line-height: 1.6;
          font-size: 14px;
          background: rgba(0, 0, 0, 0.1);
          padding: 12px;
          border-radius: 4px;
          border-left: 3px solid #61dafb;
        }

        .no-summary {
          text-align: center;
          padding: 30px;
          color: #888;
          font-style: italic;
          background: rgba(0, 0, 0, 0.1);
          border-radius: 6px;
          border: 1px dashed rgba(97, 218, 251, 0.3);
        }

        .process-button {
          padding: 10px 20px;
          background-color: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          white-space: nowrap;
          height: fit-content;
          align-self: flex-start;
        }

        .process-button:hover:not(:disabled) {
          background-color: #218838;
        }

        .process-button:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }

        .results-section {
          margin-top: 30px;
          padding: 20px 0;
          border-top: 2px solid #e0e0e0;
        }

        .results-section h3 {
          margin-top: 0;
          color: #333;
        }

        .result-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #61dafb;
          border-radius: 8px;
          padding: 20px;
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
          font-size: 14px;
        }

        .result-url {
          margin-bottom: 15px;
        }

        .result-url a {
          color: #007bff;
          text-decoration: none;
          margin-left: 10px;
        }

        .result-url a:hover {
          text-decoration: underline;
        }

        .result-stats {
          display: flex;
          gap: 20px;
          margin-bottom: 15px;
          font-size: 14px;
        }

        .result-prompt {
          margin-bottom: 15px;
        }

        .prompt-text {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid #61dafb;
          border-radius: 4px;
          padding: 10px;
          margin-top: 5px;
          font-style: italic;
          color: #e0e0e0;
        }

        .ai-response {
          margin-top: 15px;
        }

        .response-textbox {
          width: 100%;
          padding: 12px;
          border: 1px solid #61dafb;
          border-radius: 4px;
          font-family: monospace;
          font-size: 14px;
          line-height: 1.5;
          background-color: rgba(0, 0, 0, 0.3);
          color: #e0e0e0;
          resize: vertical;
          box-sizing: border-box;
        }

        .response-textbox:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }
      `}</style>
    </div>
  );
});

export default UrlList;
