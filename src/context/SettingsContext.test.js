import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import {
  SettingsProvider,
  useSettings,
  systemLightTheme,
  lightTheme,
  darkTheme,
  sepiaTheme,
  obsidianTheme,
  nordTheme,
  matchaTheme,
  asanaTheme,
  todoistTheme,
  trelloTheme,
} from './SettingsContext';
import * as SettingsRepository from '../repositories/SettingsRepository';

describe('SettingsContext', () => {
  beforeEach(() => {
    global.__mockDb.execSync('DELETE FROM entries');
  });

  it('throws an error when useSettings is called outside of SettingsProvider', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useSettings())).rejects.toThrow(
      '[useSettings] Debe usarse dentro de un <SettingsProvider>.'
    );
    consoleSpy.mockRestore();
  });

  it('loads default settings when database is empty', async () => {
    const wrapper = ({ children }) => <SettingsProvider>{children}</SettingsProvider>;
    const { result } = await renderHook(() => useSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current?.language).toBeTruthy();
    });

    expect(result.current.themePreference).toBe('system');
    expect(result.current.language).toBe('es');
    expect(result.current.timezone).toBe('Europe/Madrid');
    expect(result.current.fontFamily).toBe('system');
    expect(result.current.theme).toEqual(systemLightTheme);
    expect(result.current.isDark).toBe(false);
  });

  it('updates themePreference and switches theme', async () => {
    const wrapper = ({ children }) => <SettingsProvider>{children}</SettingsProvider>;
    const { result } = await renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current?.language).toBeTruthy());

    await act(async () => {
      result.current.setThemePreference('dark');
    });

    expect(result.current.themePreference).toBe('dark');
    expect(result.current.theme).toEqual(darkTheme);
    expect(result.current.isDark).toBe(true);

    const saved = await SettingsRepository.getAllSettings();
    expect(saved.themePreference).toBe('dark');
  });

  it('switches correctly to curated themes (sepia, dark, nord, system)', async () => {
    const wrapper = ({ children }) => <SettingsProvider>{children}</SettingsProvider>;
    const { result } = await renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current?.language).toBeTruthy());

    // 1. Moleskine Sepia
    await act(async () => {
      result.current.setThemePreference('sepia');
    });
    expect(result.current.themePreference).toBe('sepia');
    expect(result.current.theme).toEqual(sepiaTheme);
    expect(result.current.isDark).toBe(false);
    expect(result.current.fontFamily).toBe('eb-garamond');

    // 2. Monocromo Oscuro
    await act(async () => {
      result.current.setThemePreference('dark');
    });
    expect(result.current.themePreference).toBe('dark');
    expect(result.current.theme).toEqual(darkTheme);
    expect(result.current.isDark).toBe(true);

    // 3. Arctic Nord
    await act(async () => {
      result.current.setThemePreference('nord');
    });
    expect(result.current.themePreference).toBe('nord');
    expect(result.current.theme).toEqual(nordTheme);
    expect(result.current.isDark).toBe(true);
    expect(result.current.fontFamily).toBe('space-mono');

    // 4. Automático (Sistema)
    await act(async () => {
      result.current.setThemePreference('system');
    });
    expect(result.current.themePreference).toBe('system');
    expect(result.current.theme).toEqual(systemLightTheme);
  });

  it('respects syncThemeFont toggle when switching themes', async () => {
    const wrapper = ({ children }) => <SettingsProvider>{children}</SettingsProvider>;
    const { result } = await renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current?.language).toBeTruthy());

    // Disable syncThemeFont and set custom font
    await act(async () => {
      result.current.setSyncThemeFont(false);
      result.current.setFontFamily('caveat');
    });

    expect(result.current.syncThemeFont).toBe(false);
    expect(result.current.fontFamily).toBe('caveat');

    // Switch theme to obsidian - font should stay 'caveat'
    await act(async () => {
      result.current.setThemePreference('obsidian');
    });

    expect(result.current.themePreference).toBe('obsidian');
    expect(result.current.fontFamily).toBe('caveat');
  });

  it('applies typography presets correctly', async () => {
    const wrapper = ({ children }) => <SettingsProvider>{children}</SettingsProvider>;
    const { result } = await renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current?.language).toBeTruthy());

    await act(async () => {
      result.current.applyTypographyPreset('editorial');
    });

    expect(result.current.fontFamily).toBe('eb-garamond');
    expect(result.current.typographyConfig.h1.fontFamily).toBe('playfair-display');
    expect(result.current.typographyConfig.body.fontFamily).toBe('eb-garamond');

    // Apply hacker preset
    await act(async () => {
      result.current.applyTypographyPreset('hacker');
    });

    expect(result.current.fontFamily).toBe('jetbrains');
    expect(result.current.typographyConfig.h1.fontFamily).toBe('jetbrains');
    expect(result.current.typographyConfig.h3.fontFamily).toBe('fira-code');
  });

  it('updates language and persists to repository', async () => {
    const wrapper = ({ children }) => <SettingsProvider>{children}</SettingsProvider>;
    const { result } = await renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current?.language).toBeTruthy());

    await act(async () => {
      result.current.setLanguage('en');
    });

    expect(result.current.language).toBe('en');
    const saved = await SettingsRepository.getAllSettings();
    expect(saved.language).toBe('en');
  });

  it('updates timezone, fontFamily, and typographyConfig', async () => {
    const wrapper = ({ children }) => <SettingsProvider>{children}</SettingsProvider>;
    const { result } = await renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current?.language).toBeTruthy());

    await act(async () => {
      result.current.setTimezone('America/New_York');
      result.current.setFontFamily('PatrickHand');
      result.current.setTypographyConfig(prev => ({ ...prev, body: { ...prev.body, fontSize: 18 } }));
    });

    expect(result.current.timezone).toBe('America/New_York');
    expect(result.current.fontFamily).toBe('PatrickHand');
    expect(result.current.typographyConfig.body.fontSize).toBe(18);
  });

  it('resets settings to defaults with resetSettings', async () => {
    const wrapper = ({ children }) => <SettingsProvider>{children}</SettingsProvider>;
    const { result } = await renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current?.language).toBeTruthy());

    await act(async () => {
      result.current.setLanguage('en');
      result.current.setThemePreference('dark');
    });

    expect(result.current.language).toBe('en');

    await act(async () => {
      result.current.resetSettings();
    });

    expect(result.current.language).toBe('es');
    expect(result.current.themePreference).toBe('system');
  });

  it('handles PIN setup, verification, locking and removal correctly', async () => {
    const wrapper = ({ children }) => <SettingsProvider>{children}</SettingsProvider>;
    const { result } = await renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(result.current?.language).toBeTruthy());

    // Initially disabled
    expect(result.current.pinLockEnabled).toBe(false);
    expect(result.current.isUnlocked).toBe(true);

    // Setup PIN '1234'
    await act(async () => {
      result.current.setupPin('1234');
    });

    expect(result.current.pinLockEnabled).toBe(true);
    expect(result.current.pinCode).toBe('1234');
    expect(result.current.isUnlocked).toBe(true);

    // Lock app
    await act(async () => {
      result.current.lockApp();
    });
    expect(result.current.isUnlocked).toBe(false);

    // Verify wrong PIN
    let verifiedWrong;
    await act(async () => {
      verifiedWrong = result.current.verifyPin('9999');
    });
    expect(verifiedWrong).toBe(false);
    expect(result.current.isUnlocked).toBe(false);

    // Verify correct PIN
    let verifiedCorrect;
    await act(async () => {
      verifiedCorrect = result.current.verifyPin('1234');
    });
    expect(verifiedCorrect).toBe(true);
    expect(result.current.isUnlocked).toBe(true);

    // Remove PIN
    await act(async () => {
      result.current.removePin();
    });
    expect(result.current.pinLockEnabled).toBe(false);
    expect(result.current.pinCode).toBe(null);
  });
});
