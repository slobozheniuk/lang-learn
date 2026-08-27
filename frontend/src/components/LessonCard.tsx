import React from 'react';
import { Lesson } from '../types';
import { Youtube, FileText, Sparkles, Loader2, Play, CheckCircle } from 'lucide-react';

interface LessonCardProps {
  lesson: Lesson;
  onSelect?: (lesson: Lesson) => void;
}

export const LessonCard: React.FC<LessonCardProps> = ({ lesson, onSelect }) => {
  const isProcessing = lesson.status === 'processing' || lesson.status === 'pending';

  const getTypeIcon = () => {
    switch (lesson.input_type) {
      case 'youtube':
        return <Youtube size={14} color="#ef4444" />;
      case 'manual':
        return <Sparkles size={14} color="#8b5cf6" />;
      case 'text':
      default:
        return <FileText size={14} color="#3b82f6" />;
    }
  };

  const cardContent = (
    <div
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        height: '100%',
        justifyContent: 'space-between',
      }}
    >
      {/* Top Header: Input type badge & status badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="badge" style={{ textTransform: 'capitalize' }}>
            {getTypeIcon()}
            <span>{lesson.input_type}</span>
          </span>
          <span className="badge">
            {lesson.source_lang.toUpperCase()} → {lesson.target_lang.toUpperCase()}
          </span>
        </div>

        {isProcessing ? (
          <span
            className="badge badge-warning"
            data-testid="processing-badge"
            style={{ animation: 'pulse-subtle 1.5s infinite ease-in-out' }}
          >
            <Loader2 size={12} className="spinning-icon" style={{ animation: 'spin-gradient-transform 1s linear infinite' }} />
            <span>Processing</span>
          </span>
        ) : (
          <span className="badge badge-success" data-testid="ready-badge">
            <CheckCircle size={12} />
            <span>Ready</span>
          </span>
        )}
      </div>

      {/* Main info: Title & preview snippet */}
      <div>
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '6px',
            color: isProcessing ? 'var(--text-muted)' : 'var(--text-primary)',
            transition: 'color 0.2s',
          }}
          data-testid="lesson-title"
        >
          {lesson.title}
        </h3>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            opacity: isProcessing ? 0.6 : 1,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {lesson.raw_input}
        </p>
      </div>

      {/* Bottom Footer: Date & Action button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-color-subtle)',
        }}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {new Date(lesson.created_at || Date.now()).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </span>

        <button
          type="button"
          disabled={isProcessing}
          onClick={() => !isProcessing && onSelect?.(lesson)}
          className={isProcessing ? 'btn-secondary' : 'btn-primary'}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            borderRadius: 'var(--radius-sm)',
            gap: '4px',
          }}
          data-testid="lesson-action-btn"
        >
          {isProcessing ? (
            <>
              <Loader2 size={12} style={{ animation: 'spin-gradient-transform 1.5s linear infinite' }} />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Play size={12} />
              <span>Study Lesson</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  if (isProcessing) {
    return (
      <div
        className="processing-card-wrapper"
        data-testid="lesson-card-processing"
        style={{ width: '100%' }}
      >
        <div className="processing-card-inner">{cardContent}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        width: '100%',
      }}
      data-testid="lesson-card-ready"
    >
      {cardContent}
    </div>
  );
};
