import React, { useState } from 'react';
import { Send, Youtube, FileText, Plus, Sparkles, Loader2 } from 'lucide-react';

interface InputDockProps {
  onSubmit: (input: string, mode: 'text' | 'youtube') => void | Promise<void>;
  onOpenWordAdd?: () => void;
  isLoading?: boolean;
}

export const InputDock: React.FC<InputDockProps> = ({
  onSubmit,
  onOpenWordAdd,
  isLoading = false,
}) => {
  const [mode, setMode] = useState<'text' | 'youtube'>('text');
  const [value, setValue] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isLoading) return;
    await onSubmit(value.trim(), mode);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        backgroundColor: 'var(--bg-header)',
        borderTop: '1px solid var(--border-color)',
        padding: '12px 16px 16px',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.06)',
        zIndex: 90,
        backdropFilter: 'blur(10px)',
      }}
      data-testid="input-dock"
    >
      {/* Top row of dock: Mode toggles and quick action */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '2px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color-subtle)' }}>
          <button
            type="button"
            onClick={() => setMode('text')}
            data-testid="mode-text-btn"
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: 'var(--radius-full)',
              backgroundColor: mode === 'text' ? 'var(--bg-card)' : 'transparent',
              color: mode === 'text' ? 'var(--color-primary)' : 'var(--text-secondary)',
              boxShadow: mode === 'text' ? 'var(--shadow-sm)' : 'none',
              gap: '4px',
            }}
          >
            <FileText size={13} />
            <span>Raw Text</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('youtube')}
            data-testid="mode-youtube-btn"
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: 'var(--radius-full)',
              backgroundColor: mode === 'youtube' ? 'var(--bg-card)' : 'transparent',
              color: mode === 'youtube' ? '#ef4444' : 'var(--text-secondary)',
              boxShadow: mode === 'youtube' ? 'var(--shadow-sm)' : 'none',
              gap: '4px',
            }}
          >
            <Youtube size={13} />
            <span>YouTube URL</span>
          </button>
        </div>

        {onOpenWordAdd && (
          <button
            type="button"
            className="btn-secondary"
            onClick={onOpenWordAdd}
            data-testid="dock-add-word-btn"
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              fontWeight: 500,
              gap: '4px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            <Plus size={13} />
            <span>Add Word</span>
          </button>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {mode === 'text' ? (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste article, dialogue, or story to study... (Ctrl+Enter to send)"
              rows={2}
              data-testid="dock-textarea"
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                fontSize: '14px',
                color: 'var(--text-primary)',
                resize: 'none',
                outline: 'none',
                lineHeight: '1.4',
                transition: 'border-color 0.2s',
              }}
            />
          ) : (
            <input
              type="url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              data-testid="dock-url-input"
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                fontSize: '14px',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          )}
        </div>

        <button
          type="submit"
          disabled={!value.trim() || isLoading}
          className="btn-primary"
          data-testid="dock-submit-btn"
          style={{
            height: mode === 'text' ? '56px' : '44px',
            padding: '0 16px',
            borderRadius: 'var(--radius-md)',
            gap: '6px',
          }}
        >
          {isLoading ? (
            <Loader2 size={16} style={{ animation: 'spin-gradient-transform 1s linear infinite' }} />
          ) : (
            <>
              <Sparkles size={16} />
              <span style={{ display: 'inline' }}>Generate</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
