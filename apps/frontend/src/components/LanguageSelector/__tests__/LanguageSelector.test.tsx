import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { LanguageSelector } from '../LanguageSelector';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: jest.fn(),
}));

const mockPush = jest.fn();
const mockRouter = {
  locale: 'en',
  locales: ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar'],
  pathname: '/test',
  query: {},
  asPath: '/test',
  push: mockPush,
};

const mockT = jest.fn((key: string) => {
  const translations: Record<string, string> = {
    'settings.language': 'Language',
  };
  return translations[key] || key;
});

describe('LanguageSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useTranslation as jest.Mock).mockReturnValue({ t: mockT });
  });

  it('renders language selector with current language', () => {
    render(<LanguageSelector />);
    
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
  });

  it('displays all supported languages in dropdown', async () => {
    render(<LanguageSelector />);
    
    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);
    
    await waitFor(() => {
      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('Español')).toBeInTheDocument();
      expect(screen.getByText('Français')).toBeInTheDocument();
      expect(screen.getByText('Deutsch')).toBeInTheDocument();
      expect(screen.getByText('Português')).toBeInTheDocument();
      expect(screen.getByText('中文')).toBeInTheDocument();
      expect(screen.getByText('日本語')).toBeInTheDocument();
      expect(screen.getByText('한국어')).toBeInTheDocument();
      expect(screen.getByText('العربية')).toBeInTheDocument();
    });
  });

  it('changes language when option is selected', async () => {
    render(<LanguageSelector />);
    
    const select = screen.getByRole('combobox');
    fireEvent.mouseDown(select);
    
    await waitFor(() => {
      const spanishOption = screen.getByText('Español');
      fireEvent.click(spanishOption);
    });
    
    expect(mockPush).toHaveBeenCalledWith(
      { pathname: '/test', query: {} },
      '/test',
      { locale: 'es' }
    );
  });

  it('renders compact variant correctly', () => {
    render(<LanguageSelector variant="compact" />);
    
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    
    // Should not have a label in compact mode
    expect(screen.queryByLabelText('Language')).not.toBeInTheDocument();
  });

  it('shows language icon in compact mode', () => {
    render(<LanguageSelector variant="compact" />);
    
    // Check for language icon (MUI icons are rendered as SVG)
    const icon = screen.getByTestId('LanguageIcon');
    expect(icon).toBeInTheDocument();
  });
});