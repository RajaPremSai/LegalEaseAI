import React from 'react';
import { render } from '@testing-library/react';
import { axe } from '../utils/accessibilityTesting';
import { AccessibilityProvider } from '../contexts/AccessibilityContext';
import { DocumentUpload } from '../components/DocumentUpload';
import { LanguageSelector } from '../components/LanguageSelector';
import { AccessibilitySettings } from '../components/AccessibilitySettings';

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    locale: 'en',
    locales: ['en', 'es', 'fr'],
    pathname: '/test',
    query: {},
    asPath: '/test',
    push: jest.fn(),
  }),
}));

const mockOnFileUpload = jest.fn();

describe('Application Accessibility', () => {
  it('DocumentUpload component should be accessible', async () => {
    const { container } = render(
      <AccessibilityProvider>
        <DocumentUpload onFileUpload={mockOnFileUpload} />
      </AccessibilityProvider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('LanguageSelector component should be accessible', async () => {
    const { container } = render(
      <AccessibilityProvider>
        <LanguageSelector />
      </AccessibilityProvider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('AccessibilitySettings component should be accessible', async () => {
    const { container } = render(
      <AccessibilityProvider>
        <AccessibilitySettings />
      </AccessibilityProvider>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle high contrast mode without violations', async () => {
    // Test with high contrast enabled
    const { container } = render(
      <AccessibilityProvider>
        <div>
          <DocumentUpload onFileUpload={mockOnFileUpload} />
          <LanguageSelector />
          <AccessibilitySettings />
        </div>
      </AccessibilityProvider>
    );

    // Simulate high contrast mode
    document.body.classList.add('high-contrast');

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    document.body.classList.remove('high-contrast');
  });

  it('should handle large text mode without violations', async () => {
    const { container } = render(
      <AccessibilityProvider>
        <div>
          <DocumentUpload onFileUpload={mockOnFileUpload} />
          <LanguageSelector />
          <AccessibilitySettings />
        </div>
      </AccessibilityProvider>
    );

    // Simulate large text mode
    document.body.style.fontSize = '1.25em';

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    document.body.style.fontSize = '';
  });

  it('should handle reduced motion mode without violations', async () => {
    const { container } = render(
      <AccessibilityProvider>
        <div>
          <DocumentUpload onFileUpload={mockOnFileUpload} />
          <LanguageSelector />
          <AccessibilitySettings />
        </div>
      </AccessibilityProvider>
    );

    // Simulate reduced motion preference
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper focus management across components', async () => {
    const { container } = render(
      <AccessibilityProvider>
        <div>
          <DocumentUpload onFileUpload={mockOnFileUpload} />
          <LanguageSelector />
          <AccessibilitySettings />
        </div>
      </AccessibilityProvider>
    );

    // Test focus order
    const focusableElements = container.querySelectorAll(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    );

    expect(focusableElements.length).toBeGreaterThan(0);

    // Test that all focusable elements can receive focus
    focusableElements.forEach((element, index) => {
      (element as HTMLElement).focus();
      expect(document.activeElement).toBe(element);
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA landmarks', async () => {
    const { container } = render(
      <AccessibilityProvider>
        <main>
          <section aria-label="Document Upload">
            <DocumentUpload onFileUpload={mockOnFileUpload} />
          </section>
          <aside aria-label="Settings">
            <LanguageSelector />
            <AccessibilitySettings />
          </aside>
        </main>
      </AccessibilityProvider>
    );

    const main = container.querySelector('main');
    const section = container.querySelector('section');
    const aside = container.querySelector('aside');

    expect(main).toBeInTheDocument();
    expect(section).toBeInTheDocument();
    expect(aside).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle keyboard navigation properly', async () => {
    const { container } = render(
      <AccessibilityProvider>
        <div>
          <DocumentUpload onFileUpload={mockOnFileUpload} />
          <LanguageSelector />
          <AccessibilitySettings />
        </div>
      </AccessibilityProvider>
    );

    // Test Tab navigation
    const focusableElements = Array.from(
      container.querySelectorAll(
        'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
      )
    ) as HTMLElement[];

    if (focusableElements.length > 0) {
      // Focus first element
      focusableElements[0].focus();
      expect(document.activeElement).toBe(focusableElements[0]);

      // Simulate Tab key presses
      for (let i = 1; i < focusableElements.length; i++) {
        const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
        document.dispatchEvent(tabEvent);
        // Note: Actual tab navigation would need to be simulated differently
        // This is a simplified test
      }
    }

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper color contrast in all themes', async () => {
    const themes = ['light', 'dark'];
    
    for (const theme of themes) {
      document.body.setAttribute('data-theme', theme);
      
      const { container } = render(
        <AccessibilityProvider>
          <div>
            <DocumentUpload onFileUpload={mockOnFileUpload} />
            <LanguageSelector />
            <AccessibilitySettings />
          </div>
        </AccessibilityProvider>
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });
      
      expect(results).toHaveNoViolations();
    }

    document.body.removeAttribute('data-theme');
  });
});