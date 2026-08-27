import React from 'react';
import { SessionResultItem } from '../stores/reviewStore';
import { Trophy, CheckCircle2, RotateCcw, Home, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SessionSummaryProps {
  results: SessionResultItem[];
  onRestart: () => void;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({ results, onRestart }) => {
  const total = results.length;
  const againCount = results.filter((r) => r.rating === 'again' || r.score < 3).length;
  const hardCount = results.filter((r) => r.rating === 'hard' || r.score === 3).length;
  const goodCount = results.filter((r) => r.rating === 'good' || r.score === 4).length;
  const easyCount = results.filter((r) => r.rating === 'easy' || r.score === 5).length;

  const recalledCount = total - againCount;
  const recallRate = total > 0 ? Math.round((recalledCount / total) * 100) : 100;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        padding: '24px 16px',
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
        textAlign: 'center',
      }}
      data-testid="session-summary"
    >
      {/* Trophy Header */}
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(135deg, #f59e0b, #ec4899)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          boxShadow: 'var(--shadow-lg)',
          animation: 'glow-pulse 3s infinite alternate',
        }}
      >
        <Trophy size={36} />
      </div>

      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '6px' }}>
          Session Complete! 🎉
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          You reviewed <strong>{total}</strong> {total === 1 ? 'word' : 'words'}. Great job boosting your memory!
        </p>
      </div>

      {/* Retention Rate Stat Card */}
      <div
        style={{
          width: '100%',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-primary)' }}>
            {recallRate}%
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            RECALL RATE
          </span>
        </div>

        <div style={{ height: '40px', width: '1px', backgroundColor: 'var(--border-color)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--srs-easy)' }}>
            {recalledCount}/{total}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            REMEMBERED
          </span>
        </div>
      </div>

      {/* Rating Breakdown Grid */}
      <div
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--srs-again-bg)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 4px',
            border: '1px solid rgba(239, 68, 68, 0.2)',
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--srs-again)' }}>
            {againCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Again</div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--srs-hard-bg)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 4px',
            border: '1px solid rgba(245, 158, 11, 0.2)',
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--srs-hard)' }}>
            {hardCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Hard</div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--srs-good-bg)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 4px',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--srs-good)' }}>
            {goodCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Good</div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--srs-easy-bg)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 4px',
            border: '1px solid rgba(16, 185, 129, 0.2)',
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--srs-easy)' }}>
            {easyCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Easy</div>
        </div>
      </div>

      {/* Reviewed Words List */}
      {results.length > 0 && (
        <div style={{ width: '100%', textAlign: 'left' }}>
          <h4
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Reviewed Items
          </h4>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxHeight: '180px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {results.map((item, idx) => (
              <div
                key={`${item.word.id}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color-subtle)',
                  fontSize: '13px',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.word.text}
                  </span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                    {item.word.translation}
                  </span>
                </div>
                <span
                  className={`badge ${
                    item.rating === 'again'
                      ? 'badge-danger'
                      : item.rating === 'hard'
                      ? 'badge-warning'
                      : 'badge-success'
                  }`}
                  style={{ textTransform: 'capitalize' }}
                >
                  {item.rating}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '8px' }}>
        <button
          type="button"
          onClick={onRestart}
          className="btn-secondary"
          style={{ flex: 1, padding: '12px', gap: '6px' }}
          data-testid="restart-session-btn"
        >
          <RotateCcw size={16} />
          <span>Review More</span>
        </button>

        <Link
          to="/"
          className="btn-primary"
          style={{
            flex: 1,
            padding: '12px',
            gap: '6px',
            textDecoration: 'none',
            justifyContent: 'center',
          }}
          data-testid="summary-dashboard-btn"
        >
          <Home size={16} />
          <span>Dashboard</span>
        </Link>
      </div>
    </div>
  );
};
