import React, { useRef, useState } from 'react';

export interface FloatingGhost {
  id: number;
  text: string;
}

export interface BottomDockProps {
  quickInput: string;
  isSending: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (eOrText?: React.FormEvent | string) => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  quickInput,
  isSending,
  onInputChange,
  onSubmit,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ghosts, setGhosts] = useState<FloatingGhost[]>([]);

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

  const handleGhostAnimationEnd = (id: number) => {
    setGhosts((prev) => prev.filter((g) => g.id !== id));
  };

  return (
    <footer className={`bottom-dock ${isSending ? 'is-loading' : ''}`}>
      <div className="bottom-dock-container">
        <form
          id="quick-word-form"
          className="quick-word-form"
          autoComplete="off"
          onSubmit={handleSubmit}
        >
          <div className={`input-wrapper ${isSending ? 'is-sending' : ''}`}>
            {ghosts.map((ghost) => (
              <span
                key={ghost.id}
                className="input-ghost-text"
                onAnimationEnd={() => handleGhostAnimationEnd(ghost.id)}
              >
                {ghost.text}
              </span>
            ))}
            <input
              ref={inputRef}
              type="text"
              id="quick-word-input"
              className="quick-word-input"
              placeholder="Type a word or phrase..."
              autoComplete="off"
              aria-label="Type a word or phrase to add"
              value={quickInput}
              onChange={(e) => onInputChange(e.target.value)}
            />
            <button
              type="submit"
              id="btn-quick-send"
              className={`btn-quick-send ${isSending ? 'is-loading' : ''}`}
              title="Add Word"
              aria-label="Add Word"
            >
              {isSending && <span className="send-spinner-indicator" aria-hidden="true" />}
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
