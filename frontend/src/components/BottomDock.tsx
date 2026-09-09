import React, { useRef, useState, useEffect } from 'react';

export interface FloatingGhost {
  id: number;
  text: string;
}

export interface BottomDockProps {
  quickInput: string;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  quickInput,
  onInputChange,
  onSubmit,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [ghosts, setGhosts] = useState<FloatingGhost[]>([]);

  // Auto-grow textarea height to fit content
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [quickInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = quickInput.trim();
    if (!raw) return;

    // Trigger ghost fade-away-up animation
    const ghostId = Date.now() + Math.random();
    setGhosts((prev) => [...prev, { id: ghostId, text: raw }]);

    // Immediately clear the input value
    onInputChange('');

    // Keep focus in the input field without causing unwanted viewport jumps
    inputRef.current?.focus({ preventScroll: true });

    // Submit word/text to parent handler
    onSubmit(raw);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift submits; Shift+Enter inserts a newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleGhostAnimationEnd = (id: number) => {
    setGhosts((prev) => prev.filter((g) => g.id !== id));
  };

  return (
    <footer className="bottom-dock">
      <div className="bottom-dock-container">
        <form
          id="quick-word-form"
          className="quick-word-form"
          autoComplete="off"
          onSubmit={handleSubmit}
        >
          <div className="input-wrapper">
            {ghosts.map((ghost) => (
              <span
                key={ghost.id}
                className="input-ghost-text"
                onAnimationEnd={() => handleGhostAnimationEnd(ghost.id)}
              >
                {ghost.text}
              </span>
            ))}
            <textarea
              ref={inputRef}
              id="quick-word-input"
              className="quick-word-input"
              placeholder="Type a word, phrase, or paste text..."
              autoComplete="off"
              aria-label="Type a word or phrase to add"
              value={quickInput}
              rows={1}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="submit"
              id="btn-quick-send"
              className="btn-quick-send"
              title="Add Word"
              aria-label="Add Word"
            >
              <svg
                className="send-icon"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </form>
      </div>
    </footer>
  );
};
