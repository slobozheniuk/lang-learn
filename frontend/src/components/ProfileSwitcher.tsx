import React, { useState, useRef, useEffect } from 'react';
import { Language, LearningProfile } from '../types';
import { fetchProfiles, createProfile, switchProfile } from '../api';
import { triggerHaptic } from '../utils/srs';

const LANG_FLAGS: Record<string, string> = {
  ru: '🇷🇺',
  en: '🇬🇧',
  nl: '🇳🇱',
  de: '🇩🇪',
  fr: '🇫🇷',
  es: '🇪🇸',
  it: '🇮🇹',
  pt: '🇵🇹',
  zh: '🇨🇳',
  ja: '🇯🇵',
  ko: '🇰🇷',
  ar: '🇸🇦',
  tr: '🇹🇷',
  pl: '🇵🇱',
  uk: '🇺🇦',
};

function getFlag(code: string): string {
  return LANG_FLAGS[code?.toLowerCase()] || '🏳️';
}

interface ProfileSwitcherProps {
  languages: Language[];
  onProfileSwitch: () => void;
}

export const ProfileSwitcher: React.FC<ProfileSwitcherProps> = ({ languages, onProfileSwitch }) => {
  const [profiles, setProfiles] = useState<LearningProfile[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSourceLang, setNewSourceLang] = useState('ru');
  const [newTargetLang, setNewTargetLang] = useState('en');
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeProfile = profiles.find((p) => p.is_active) || profiles[0] || null;

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const data = await fetchProfiles();
      setProfiles(data);
    } catch (e) {
      console.warn('Failed to load profiles:', e);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowAddForm(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSwitchProfile = async (profileId: number) => {
    try {
      setIsLoading(true);
      await switchProfile(profileId);
      triggerHaptic('success');
      await loadProfiles();
      setIsOpen(false);
      onProfileSwitch();
    } catch (e) {
      console.warn('Failed to switch profile:', e);
      triggerHaptic('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await createProfile({
        source_language: newSourceLang,
        target_language: newTargetLang,
      });
      triggerHaptic('success');
      await loadProfiles();
      setShowAddForm(false);
      setIsOpen(false);
      onProfileSwitch();
    } catch (e) {
      console.warn('Failed to create profile:', e);
      triggerHaptic('error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!activeProfile && profiles.length === 0) {
    return null;
  }

  return (
    <div className="profile-switcher" ref={dropdownRef}>
      <button
        id="profile-switcher-btn"
        className="profile-switcher-btn"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setShowAddForm(false);
        }}
        title="Switch learning profile"
        aria-label="Switch learning profile"
      >
        {activeProfile ? (
          <span className="profile-flags">
            <span>{getFlag(activeProfile.source_language)}</span>
            <span className="profile-arrow">➔</span>
            <span>{getFlag(activeProfile.target_language)}</span>
          </span>
        ) : (
          <span>🌐</span>
        )}
      </button>

      {isOpen && (
        <div className="profile-dropdown" role="menu">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              className={`profile-dropdown-item${profile.is_active ? ' active' : ''}`}
              onClick={() => handleSwitchProfile(profile.id)}
              disabled={isLoading || profile.is_active}
            >
              <span>{getFlag(profile.source_language)}</span>
              <span className="profile-arrow-sm">➔</span>
              <span>{getFlag(profile.target_language)}</span>
              <span className="profile-lang-label">
                {profile.source_language.toUpperCase()} → {profile.target_language.toUpperCase()}
              </span>
              {profile.is_active && <span className="profile-active-dot">●</span>}
            </button>
          ))}

          <div className="profile-dropdown-divider" />

          {showAddForm ? (
            <form className="profile-add-form" onSubmit={handleCreateProfile}>
              <select
                className="lang-select profile-lang-select"
                value={newSourceLang}
                onChange={(e) => setNewSourceLang(e.target.value)}
              >
                {(languages.length > 0 ? languages : Object.keys(LANG_FLAGS).map(c => ({ code: c, name: c }))).map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {getFlag(lang.code)} {lang.code.toUpperCase()}
                  </option>
                ))}
              </select>
              <span className="profile-arrow-sm">➔</span>
              <select
                className="lang-select profile-lang-select"
                value={newTargetLang}
                onChange={(e) => setNewTargetLang(e.target.value)}
              >
                {(languages.length > 0 ? languages : Object.keys(LANG_FLAGS).map(c => ({ code: c, name: c }))).map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {getFlag(lang.code)} {lang.code.toUpperCase()}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary btn-sm" disabled={isLoading}>
                {isLoading ? '...' : '✓'}
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAddForm(false)}>
                ✕
              </button>
            </form>
          ) : (
            <button
              id="profile-add-btn"
              className="profile-dropdown-item profile-add-item"
              onClick={() => setShowAddForm(true)}
            >
              <span>+</span>
              <span className="profile-lang-label">Add profile</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
