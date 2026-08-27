import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('TWA CSS Theme & Animations Spec', () => {
  it('defines required Telegram Web App CSS variables with fallbacks in theme.css', () => {
    const themeCss = fs.readFileSync(
      path.resolve(__dirname, '../styles/theme.css'),
      'utf-8'
    );

    // Verify key Telegram Web App variables
    expect(themeCss).toContain('--tg-theme-bg-color');
    expect(themeCss).toContain('--tg-theme-text-color');
    expect(themeCss).toContain('--tg-theme-button-color');
    expect(themeCss).toContain('--tg-theme-button-text-color');
    expect(themeCss).toContain('--tg-theme-secondary-bg-color');
    expect(themeCss).toContain('--tg-theme-header-bg-color');

    // Verify SRS rating tokens
    expect(themeCss).toContain('--srs-again');
    expect(themeCss).toContain('--srs-hard');
    expect(themeCss).toContain('--srs-good');
    expect(themeCss).toContain('--srs-easy');

    // Verify dark mode media query / override
    expect(themeCss).toContain('prefers-color-scheme: dark');
  });

  it('defines rainbow spinning gradient animation keyframes in animations.css', () => {
    const animCss = fs.readFileSync(
      path.resolve(__dirname, '../styles/animations.css'),
      'utf-8'
    );

    expect(animCss).toContain('spin-gradient-property');
    expect(animCss).toContain('spin-gradient-transform');
    expect(animCss).toContain('conic-gradient');
    expect(animCss).toContain('.processing-card-wrapper');
    expect(animCss).toContain('.flashcard-scene');
    expect(animCss).toContain('.is-flipped');
  });
});
