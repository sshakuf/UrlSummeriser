import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { supabase } from "../lib/supabase";

interface Prompt {
  id: number;
  prompt_name: string;
  prompt: string;
  description: string;
  created_at?: string;
}

export interface PromptsPageRef {
  refreshPrompts: () => void;
}

const PromptsPage = forwardRef<PromptsPageRef>((props, ref) => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    prompt_name: "",
    prompt: "",
    description: ""
  });

  // Fetch prompts from database
  const fetchPrompts = async () => {
    try {
      setLoading(true);
      setError("");
      const { data, error } = await supabase
        .from("prompts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setPrompts(data || []);
    } catch (err: any) {
      setError(`Failed to fetch prompts: ${err.message}`);
      console.error("Error fetching prompts:", err);
    } finally {
      setLoading(false);
    }
  };

  // Expose refresh function to parent via ref
  useImperativeHandle(ref, () => ({
    refreshPrompts: fetchPrompts
  }));

  // Load prompts on component mount
  useEffect(() => {
    fetchPrompts();
  }, []);

  // Add new prompt
  const handleAddPrompt = async () => {
    if (!formData.prompt_name.trim() || !formData.prompt.trim()) {
      setError("Prompt name and prompt text are required");
      return;
    }

    try {
      setError("");
      const { error } = await supabase
        .from("prompts")
        .insert([{
          prompt_name: formData.prompt_name.trim(),
          prompt: formData.prompt.trim(),
          description: formData.description.trim()
        }]);

      if (error) {
        throw error;
      }

      // Reset form and refresh
      setFormData({ prompt_name: "", prompt: "", description: "" });
      setShowAddForm(false);
      fetchPrompts();
    } catch (err: any) {
      setError(`Failed to add prompt: ${err.message}`);
      console.error("Error adding prompt:", err);
    }
  };

  // Update existing prompt
  const handleUpdatePrompt = async (id: number) => {
    const prompt = prompts.find(p => p.id === id);
    if (!prompt) return;

    if (!prompt.prompt_name.trim() || !prompt.prompt.trim()) {
      setError("Prompt name and prompt text are required");
      return;
    }

    try {
      setError("");
      const { error } = await supabase
        .from("prompts")
        .update({
          prompt_name: prompt.prompt_name.trim(),
          prompt: prompt.prompt.trim(),
          description: prompt.description.trim()
        })
        .eq('id', id);

      if (error) {
        throw error;
      }

      setEditingId(null);
      fetchPrompts();
    } catch (err: any) {
      setError(`Failed to update prompt: ${err.message}`);
      console.error("Error updating prompt:", err);
    }
  };

  // Delete prompt
  const handleDeletePrompt = async (id: number) => {
    if (!confirm("Are you sure you want to delete this prompt? This action cannot be undone.")) {
      return;
    }

    try {
      setError("");
      const { error } = await supabase
        .from("prompts")
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      fetchPrompts();
    } catch (err: any) {
      setError(`Failed to delete prompt: ${err.message}`);
      console.error("Error deleting prompt:", err);
    }
  };

  // Update prompt field
  const updatePromptField = (id: number, field: keyof Prompt, value: string) => {
    setPrompts(prompts.map(prompt => 
      prompt.id === id ? { ...prompt, [field]: value } : prompt
    ));
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    fetchPrompts(); // Refresh to reset any changes
  };

  // Cancel add form
  const cancelAdd = () => {
    setShowAddForm(false);
    setFormData({ prompt_name: "", prompt: "", description: "" });
  };

  const formatDate = (dateString?: string) => {
    return dateString ? new Date(dateString).toLocaleString() : 'Unknown';
  };

  return (
    <div className="prompts-page-container">
      <div className="header-section">
        <h2>Manage Prompts</h2>
        <button
          onClick={() => setShowAddForm(true)}
          disabled={showAddForm || editingId !== null}
          className="add-button"
        >
          Add New Prompt
        </button>
      </div>

      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="prompt-card add-form">
          <div className="prompt-header">
            <h3>Add New Prompt</h3>
            <div className="action-buttons">
              <button onClick={handleAddPrompt} className="save-button">
                Save
              </button>
              <button onClick={cancelAdd} className="cancel-button">
                Cancel
              </button>
            </div>
          </div>
          
          <div className="form-group">
            <label>Prompt Name:</label>
            <input
              type="text"
              value={formData.prompt_name}
              onChange={(e) => setFormData({ ...formData, prompt_name: e.target.value })}
              placeholder="Enter prompt name..."
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Description:</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter description (optional)..."
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Prompt Text:</label>
            <textarea
              value={formData.prompt}
              onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
              placeholder="Enter the prompt text..."
              className="form-textarea"
              rows={4}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">
          <p>Loading prompts...</p>
        </div>
      ) : prompts.length === 0 ? (
        <div className="no-prompts">
          <p>No prompts found. Add your first prompt to get started.</p>
        </div>
      ) : (
        <div className="prompts-grid">
          {prompts.map((prompt) => (
            <div key={prompt.id} className="prompt-card">
              <div className="prompt-header">
                <div className="prompt-meta">
                  {editingId === prompt.id ? (
                    <input
                      type="text"
                      value={prompt.prompt_name}
                      onChange={(e) => updatePromptField(prompt.id, 'prompt_name', e.target.value)}
                      className="edit-input"
                    />
                  ) : (
                    <h3>{prompt.prompt_name}</h3>
                  )}
                  <span className="prompt-date">
                    Created: {formatDate(prompt.created_at)}
                  </span>
                </div>
                
                <div className="action-buttons">
                  {editingId === prompt.id ? (
                    <>
                      <button
                        onClick={() => handleUpdatePrompt(prompt.id)}
                        className="save-button"
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="cancel-button"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingId(prompt.id)}
                        disabled={showAddForm || (editingId !== null && editingId !== prompt.id)}
                        className="edit-button"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePrompt(prompt.id)}
                        disabled={showAddForm || editingId !== null}
                        className="delete-button"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Description:</label>
                {editingId === prompt.id ? (
                  <input
                    type="text"
                    value={prompt.description}
                    onChange={(e) => updatePromptField(prompt.id, 'description', e.target.value)}
                    className="edit-input"
                    placeholder="Enter description..."
                  />
                ) : (
                  <p className="description-text">
                    {prompt.description || 'No description provided'}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label>Prompt Text:</label>
                {editingId === prompt.id ? (
                  <textarea
                    value={prompt.prompt}
                    onChange={(e) => updatePromptField(prompt.id, 'prompt', e.target.value)}
                    className="edit-textarea"
                    rows={4}
                  />
                ) : (
                  <div className="prompt-text-display">
                    {prompt.prompt}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .prompts-page-container {
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

        .add-button {
          padding: 10px 20px;
          background-color: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .add-button:hover:not(:disabled) {
          background-color: #218838;
        }

        .add-button:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
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
        .no-prompts {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        .prompts-grid {
          display: grid;
          gap: 20px;
          margin-bottom: 30px;
        }

        .prompt-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #61dafb;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .add-form {
          border: 2px solid #28a745;
          background: rgba(40, 167, 69, 0.1);
        }

        .prompt-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(97, 218, 251, 0.2);
        }

        .prompt-meta h3 {
          margin: 0 0 5px 0;
          color: #61dafb;
          font-size: 18px;
        }

        .prompt-date {
          font-size: 12px;
          color: #888;
        }

        .action-buttons {
          display: flex;
          gap: 10px;
        }

        .edit-button,
        .save-button {
          padding: 6px 12px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .edit-button:hover:not(:disabled),
        .save-button:hover:not(:disabled) {
          background-color: #0056b3;
        }

        .delete-button {
          padding: 6px 12px;
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .delete-button:hover:not(:disabled) {
          background-color: #c82333;
        }

        .cancel-button {
          padding: 6px 12px;
          background-color: #6c757d;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .cancel-button:hover {
          background-color: #5a6268;
        }

        .edit-button:disabled,
        .delete-button:disabled,
        .save-button:disabled {
          background-color: #6c757d;
          cursor: not-allowed;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
          color: #61dafb;
          font-size: 14px;
        }

        .form-input,
        .edit-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
          background-color: rgba(255, 255, 255, 0.9);
          color: #282c34;
          box-sizing: border-box;
        }

        .form-textarea,
        .edit-textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
          background-color: rgba(255, 255, 255, 0.9);
          color: #282c34;
          box-sizing: border-box;
          resize: vertical;
          font-family: inherit;
        }

        .description-text {
          margin: 0;
          color: #e0e0e0;
          font-style: italic;
          font-size: 14px;
        }

        .prompt-text-display {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(97, 218, 251, 0.3);
          border-radius: 4px;
          padding: 12px;
          color: #e0e0e0;
          line-height: 1.5;
          font-size: 14px;
          white-space: pre-wrap;
          word-wrap: break-word;
        }

        @media (max-width: 768px) {
          .prompt-header {
            flex-direction: column;
            gap: 10px;
          }
          
          .action-buttons {
            align-self: stretch;
          }
        }
      `}</style>
    </div>
  );
});

export default PromptsPage;