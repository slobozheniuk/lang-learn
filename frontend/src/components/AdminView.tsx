import React, { useEffect, useState } from 'react';
import { fetchAdminJourneys, fetchAdminUsers } from '../api';
import { AdminUserStats, JourneyLog } from '../types';

interface AdminViewProps {
  onBack?: () => void;
}

export const AdminView: React.FC<AdminViewProps> = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
  const [users, setUsers] = useState<AdminUserStats[]>([]);
  const [journeys, setJourneys] = useState<JourneyLog[]>([]);
  const [selectedJourney, setSelectedJourney] = useState<JourneyLog | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load users
  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAdminUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load admin user stats');
    } finally {
      setLoading(false);
    }
  };

  // Load journeys
  const loadJourneys = async (type?: string) => {
    try {
      setLoading(true);
      setError(null);
      const filter = type !== undefined ? type : filterType;
      const data = await fetchAdminJourneys(filter);
      setJourneys(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to parse and load log journeys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    } else {
      loadJourneys();
    }
  }, [activeTab]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setFilterType(val);
    loadJourneys(val);
  };

  // Aggregate stats
  const totalUsers = users.length;
  const totalLessons = users.reduce((acc, u) => acc + (u.lesson_count || 0), 0);
  const totalWords = users.reduce((acc, u) => acc + (u.word_count || 0), 0);

  return (
    <div id="admin-view" className="admin-view-container">
      {/* Header Bar */}
      <div className="admin-header">
        <div className="admin-title-group">
          <span className="admin-shield-icon">🛡️</span>
          <h2>Admin Dashboard</h2>
          <span className="admin-pill-badge">System Administrator</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="admin-tabs-nav">
        <button
          id="admin-tab-users"
          className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('users');
            setSelectedJourney(null);
          }}
        >
          👥 Users & Statistics
        </button>
        <button
          id="admin-tab-logs"
          className={`admin-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('logs');
            setSelectedJourney(null);
          }}
        >
          📜 Log Journeys
        </button>
      </div>

      {error && <div className="admin-error-banner">⚠️ {error}</div>}

      {/* TAB 1: Users & Stats */}
      {activeTab === 'users' && (
        <div id="admin-users-panel" className="admin-panel">
          {/* Summary Metric Cards */}
          <div className="admin-metrics-grid">
            <div className="admin-metric-card" id="stat-total-users">
              <span className="metric-icon">👤</span>
              <div className="metric-info">
                <span className="metric-value">{totalUsers}</span>
                <span className="metric-label">Total Users</span>
              </div>
            </div>
            <div className="admin-metric-card" id="stat-total-lessons">
              <span className="metric-icon">📚</span>
              <div className="metric-info">
                <span className="metric-value">{totalLessons}</span>
                <span className="metric-label">Total Lessons</span>
              </div>
            </div>
            <div className="admin-metric-card" id="stat-total-words">
              <span className="metric-icon">📖</span>
              <div className="metric-info">
                <span className="metric-value">{totalWords}</span>
                <span className="metric-label">Words Practiced</span>
              </div>
            </div>
          </div>

          {/* Users List */}
          <div className="admin-section-header">
            <h3>Registered Users ({users.length})</h3>
            <button className="btn-refresh" onClick={loadUsers} disabled={loading}>
              🔄 Refresh
            </button>
          </div>

          {loading && users.length === 0 ? (
            <div className="admin-loading">Loading users...</div>
          ) : (
            <div id="admin-users-list" className="admin-users-list">
              {users.map((u) => (
                <div key={u.id} className="admin-user-card" data-user-id={u.id}>
                  <div className="user-card-header">
                    <div className="user-card-title">
                      <span className="admin-user-name">@{u.username}</span>
                      {u.is_admin ? (
                        <span className="admin-role-badge admin">Admin</span>
                      ) : (
                        <span className="admin-role-badge user">User</span>
                      )}
                    </div>
                    <span className="admin-user-date">
                      Joined {new Date(u.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="user-card-stats">
                    <div className="user-stat-item">
                      <span className="user-stat-label">Lessons</span>
                      <span className="user-stat-value admin-user-lessons">{u.lesson_count}</span>
                    </div>
                    <div className="user-stat-item">
                      <span className="user-stat-label">Words</span>
                      <span className="user-stat-value admin-user-words">{u.word_count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Log Journeys View */}
      {activeTab === 'logs' && (
        <div id="admin-logs-panel" className="admin-panel">
          {/* If a journey is selected, show Separate Journey Detail View */}
          {selectedJourney ? (
            <div id="admin-journey-detail-view" className="admin-journey-detail">
              <div className="detail-top-bar">
                <button
                  id="btn-back-to-journeys"
                  className="btn-back-to-journeys"
                  onClick={() => setSelectedJourney(null)}
                >
                  ← Back to Journeys
                </button>
                <span className={`journey-status-badge ${selectedJourney.status}`}>
                  {selectedJourney.status.toUpperCase()}
                </span>
              </div>

              {/* Journey Overview Card */}
              <div className="journey-detail-card">
                <div className="journey-detail-header">
                  <div className="header-badges">
                    <span className={`journey-type-badge ${selectedJourney.journey_type}`}>
                      {selectedJourney.journey_type === 'lesson_creation'
                        ? '📚 Lesson Creation'
                        : '📝 Word Adding'}
                    </span>
                    <span className="journey-id-tag">ID: {selectedJourney.journey_id}</span>
                  </div>
                  <span className="journey-timestamp">{selectedJourney.timestamp}</span>
                </div>

                <div className="journey-meta-row">
                  <span className="journey-user">
                    User: {selectedJourney.username ? `@${selectedJourney.username}` : `ID: ${selectedJourney.user_id || 'N/A'}`}
                  </span>
                </div>

                {selectedJourney.input_text && (
                  <div className="journey-raw-input">
                    <span className="field-label">Original Input Text:</span>
                    <div className="input-text-content">{selectedJourney.input_text}</div>
                  </div>
                )}

                {/* Which Chunks User Have Chosen */}
                {selectedJourney.chosen_chunks && selectedJourney.chosen_chunks.length > 0 && (
                  <div className="journey-chosen-chunks">
                    <span className="field-label">
                      Chosen Chunks by User ({selectedJourney.chosen_chunks.length}):
                    </span>
                    <div className="chunks-chips-container">
                      {selectedJourney.chosen_chunks.map((chunk, idx) => (
                        <span key={idx} className="chosen-chunk-chip">
                          {chunk}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Progress of Actions Stepper */}
              <div className="journey-section-title">
                <h4>Progress of Actions ({selectedJourney.actions.length} steps)</h4>
              </div>
              <div className="journey-progress">
                {selectedJourney.actions.map((act, idx) => (
                  <div key={idx} className="journey-action-step">
                    <div className="step-circle">{idx + 1}</div>
                    <div className="step-body">
                      <div className="step-header">
                        <span className="step-name">{act.name}</span>
                        <span className="step-time">{act.timestamp}</span>
                      </div>
                      {act.details && Object.keys(act.details).length > 0 && (
                        <div className="step-details-snippet">
                          {act.details.preview && <div>Preview: {act.details.preview}</div>}
                          {act.details.title && <div>Title: {act.details.title}</div>}
                          {act.details.word_count !== undefined && <div>Words: {act.details.word_count}</div>}
                          {act.details.chunks_count !== undefined && <div>Chunks: {act.details.chunks_count}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Request to LLM with Input Prompt & Output of LLM */}
              <div className="journey-section-title">
                <h4>LLM Interactions ({selectedJourney.llm_interactions.length})</h4>
              </div>
              <div className="journey-llm-section">
                {selectedJourney.llm_interactions.length === 0 ? (
                  <div className="no-llm-msg">No LLM requests captured for this journey.</div>
                ) : (
                  selectedJourney.llm_interactions.map((interaction, idx) => (
                    <div key={idx} className="llm-interaction-card">
                      <div className="llm-interaction-title">
                        <span>🤖 {interaction.step || `LLM Call #${idx + 1}`}</span>
                        <span className="step-time">{interaction.timestamp}</span>
                      </div>

                      {/* Request to LLM with Input Prompt */}
                      <div className="llm-box input-prompt-box">
                        <div className="llm-box-title">Request to LLM (Input Prompt):</div>
                        <pre className="llm-input-prompt">
                          {interaction.prompt || '(No prompt payload recorded)'}
                        </pre>
                      </div>

                      {/* Output of LLM */}
                      <div className="llm-box output-box">
                        <div className="llm-box-title">Output of LLM:</div>
                        <pre className="llm-output-text">
                          {interaction.output || '(No response payload recorded)'}
                        </pre>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Journeys List (Buttons) */
            <>
              <div className="admin-logs-controls">
                <div className="filter-group">
                  <label htmlFor="filter-journey-type">Journey Filter:</label>
                  <select
                    id="filter-journey-type"
                    className="admin-select"
                    value={filterType}
                    onChange={handleFilterChange}
                  >
                    <option value="all">All Journeys</option>
                    <option value="word_adding">Word Adding</option>
                    <option value="lesson_creation">Lesson Creation</option>
                  </select>
                </div>
                <button
                  id="btn-refresh-logs"
                  className="btn-refresh"
                  onClick={() => loadJourneys()}
                  disabled={loading}
                >
                  🔄 Parse Log File
                </button>
              </div>

              <div className="admin-section-header">
                <h3>Extracted User Journeys ({journeys.length})</h3>
                <span className="admin-hint">Tap any journey to inspect details, LLM prompts, and chunks</span>
              </div>

              {loading && journeys.length === 0 ? (
                <div className="admin-loading">Reading and parsing log file...</div>
              ) : journeys.length === 0 ? (
                <div className="admin-empty-state">
                  No journeys found in log file. Perform word additions or lesson creations to generate journey logs.
                </div>
              ) : (
                <div id="admin-journeys-list" className="admin-journeys-list">
                  {journeys.map((j) => (
                    <button
                      key={j.journey_id}
                      id={`journey-${j.journey_id}`}
                      className="admin-journey-item-btn"
                      onClick={() => setSelectedJourney(j)}
                    >
                      <div className="btn-left">
                        <div className="journey-btn-header">
                          <span className={`journey-type-badge ${j.journey_type}`}>
                            {j.journey_type === 'lesson_creation' ? '📚 Lesson' : '📝 Word'}
                          </span>
                          <span className={`journey-status-badge ${j.status}`}>
                            {j.status}
                          </span>
                          <span className="journey-timestamp">{j.timestamp}</span>
                        </div>
                        <div className="journey-btn-summary">
                          <span className="journey-user">
                            @{j.username || (j.user_id ? `user_${j.user_id}` : 'user')}
                          </span>
                          {j.input_text && (
                            <span className="journey-preview-text">
                              &ldquo;{j.input_text.slice(0, 45)}
                              {j.input_text.length > 45 ? '...' : ''}&rdquo;
                            </span>
                          )}
                          {j.chosen_chunks && j.chosen_chunks.length > 0 && (
                            <span className="journey-chunks-badge">
                              {j.chosen_chunks.length} chunks chosen
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="journey-arrow">→</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
