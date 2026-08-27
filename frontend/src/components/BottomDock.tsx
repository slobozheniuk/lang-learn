import React from 'react';

interface BottomDockProps {
  quickInput: string;
  isSending: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  quickInput,
  isSending,
  onInputChange,
  onSubmit,
}) => {
  return (
    <footer className="bottom-dock">
      <div className="bottom-dock-container">
        <form
          id="quick-word-form"
          className="quick-word-form"
          autoComplete="off"
          onSubmit={onSubmit}
        >
          <div className="input-wrapper">
            <input
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
              className="btn-quick-send"
              title="Add Word"
              aria-label="Add Word"
              disabled={isSending}
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
