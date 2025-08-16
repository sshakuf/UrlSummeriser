import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface EnteredURLProps {
  onSummaryReceived?: (summary: string) => void
  onUrlProcessed?: () => void // Callback to refresh URL list
}

interface Prompt {
  id: number;
  prompt_name: string;
  prompt: string;
  description: string;
}

const EnteredURL: React.FC<EnteredURLProps> = ({ onSummaryReceived, onUrlProcessed }) => {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null)

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
      // Auto-select first prompt if available
      if (data && data.length > 0 && !selectedPromptId) {
        setSelectedPromptId(data[0].id);
      }
    } catch (err: any) {
      setError(`Failed to fetch prompts: ${err.message}`);
      console.error("Error fetching prompts:", err);
    }
  };

  // Load prompts on component mount
  useEffect(() => {
    fetchPrompts();
  }, []);

  const handleSummarize = async () => {
    if (!url.trim()) {
      setError('Please enter a valid URL')
      return
    }

    if (!selectedPromptId) {
      setError('Please select a prompt')
      return
    }

    setLoading(true)
    setError('')
    setSummary('')

    try {
      const { data, error: functionError } = await supabase.functions.invoke('summerize_url', {
        body: { 
          url: url.trim(),
          prompt_id: selectedPromptId 
        }
      })

      if (functionError) {
        throw functionError
      }

      if (data?.processed) {
        const summaryResult = data?.summary || 'URL processed successfully!'
        setSummary(summaryResult)
        
        if (onSummaryReceived) {
          onSummaryReceived(summaryResult)
        }
      } else {
        setSummary('URL added successfully!')
      }
      
      setUrl('') // Clear the input after successful add
      
      // Trigger URL list refresh
      if (onUrlProcessed) {
        onUrlProcessed()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process URL')
      console.error('Error calling edge function:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSummarize()
    }
  }

  return (
    <div className="entered-url-container">
      <div className="input-group">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Add new URL..."
          className="url-input"
          disabled={loading}
        />
        <select
          value={selectedPromptId || ""}
          onChange={(e) => setSelectedPromptId(e.target.value ? Number(e.target.value) : null)}
          className="prompt-select"
          disabled={loading}
        >
          <option value="">Choose prompt...</option>
          {prompts.map((prompt) => (
            <option key={prompt.id} value={prompt.id}>
              {prompt.prompt_name}
            </option>
          ))}
        </select>
        <button 
          onClick={handleSummarize}
          disabled={loading || !url.trim() || !selectedPromptId}
          className="summarize-button"
        >
          {loading ? 'Processing...' : 'Add & Analyze'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      )}

      {summary && (
        <div className="summary-result">
          <p>✅ {summary}</p>
        </div>
      )}

    </div>
  )
}

export default EnteredURL