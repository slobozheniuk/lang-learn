import React from 'react';
import { User } from '../types';
import { triggerHaptic } from '../utils/srs';

interface SettingsViewProps {
  user: User | null;
  onUpdateUser?: (updated: User) => void;
  onLogout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onLogout,
}) => {
  return (
    <div id="settings-view" className="settings-view-container">
      <div className="settings-card">
        <div className="settings-header">
          <div className="settings-icon-badge">⚙️</div>
          <h2 className="settings-title">Settings</h2>
          <p className="settings-subtitle">Manage your account</p>
        </div>

        {/* User Account Info */}
        {user && (
          <div className="settings-user-info">
            <div className="settings-avatar">👤</div>
            <div className="settings-user-meta">
              <div className="settings-user-name">{user.username}</div>
            </div>
          </div>
        )}

        {/* Sign Out Action */}
        <div className="settings-section settings-logout-section">
          <button
            type="button"
            id="btn-logout"
            className="btn btn-danger btn-full"
            onClick={() => {
              triggerHaptic('impact');
              onLogout();
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
