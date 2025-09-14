'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { createAccessibilityTheme, AccessibilitySettings } from '../theme/accessibilityTheme';

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (newSettings: Partial<AccessibilitySettings>) => void;
  toggleHighContrast: () => void;
  toggleLargeText: () => void;
  toggleReducedMotion: () => void;
  toggleFocusVisible: () => void;
  resetSettings: () => void;
}

const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  focusVisible: true,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

interface AccessibilityProviderProps {
  children: ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('accessibilitySettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (error) {
        console.error('Failed to parse accessibility settings:', error);
      }
    }

    // Detect system preferences
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;

    setThemeMode(prefersDark ? 'dark' : 'light');
    
    if (prefersReducedMotion || prefersHighContrast) {
      setSettings(prev => ({
        ...prev,
        reducedMotion: prefersReducedMotion,
        highContrast: prefersHighContrast,
      }));
    }

    // Listen for system preference changes
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');

    const handleDarkModeChange = (e: MediaQueryListEvent) => {
      setThemeMode(e.matches ? 'dark' : 'light');
    };

    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setSettings(prev => ({ ...prev, reducedMotion: e.matches }));
    };

    const handleHighContrastChange = (e: MediaQueryListEvent) => {
      setSettings(prev => ({ ...prev, highContrast: e.matches }));
    };

    darkModeQuery.addEventListener('change', handleDarkModeChange);
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
    highContrastQuery.addEventListener('change', handleHighContrastChange);

    return () => {
      darkModeQuery.removeEventListener('change', handleDarkModeChange);
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
      highContrastQuery.removeEventListener('change', handleHighContrastChange);
    };
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('accessibilitySettings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const toggleHighContrast = () => {
    setSettings(prev => ({ ...prev, highContrast: !prev.highContrast }));
  };

  const toggleLargeText = () => {
    setSettings(prev => ({ ...prev, largeText: !prev.largeText }));
  };

  const toggleReducedMotion = () => {
    setSettings(prev => ({ ...prev, reducedMotion: !prev.reducedMotion }));
  };

  const toggleFocusVisible = () => {
    setSettings(prev => ({ ...prev, focusVisible: !prev.focusVisible }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  const theme = createAccessibilityTheme(themeMode, settings);

  const contextValue: AccessibilityContextType = {
    settings,
    updateSettings,
    toggleHighContrast,
    toggleLargeText,
    toggleReducedMotion,
    toggleFocusVisible,
    resetSettings,
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = (): AccessibilityContextType => {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};