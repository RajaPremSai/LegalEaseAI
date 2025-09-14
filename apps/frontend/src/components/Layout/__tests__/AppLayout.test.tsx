import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../theme';
import { AppLayout } from '../AppLayout';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

// Mock useMediaQuery to control mobile/desktop behavior
jest.mock('@mui/material/useMediaQuery', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseMediaQuery = require('@mui/material/useMediaQuery').default;

describe('AppLayout', () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReturnValue(false); // Default to desktop
  });

  it('renders app bar with title', () => {
    renderWithTheme(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    );

    expect(screen.getByText('Legal Document AI Assistant')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('shows navigation items in desktop drawer', () => {
    renderWithTheme(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    );

    expect(screen.getByText('Legal AI')).toBeInTheDocument();
    expect(screen.getByText('Upload Document')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('shows mobile menu button on mobile', () => {
    mockUseMediaQuery.mockReturnValue(true); // Mobile view

    renderWithTheme(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    );

    expect(screen.getByLabelText('open drawer')).toBeInTheDocument();
  });

  it('opens mobile drawer when menu button is clicked', () => {
    mockUseMediaQuery.mockReturnValue(true); // Mobile view

    renderWithTheme(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    );

    const menuButton = screen.getByLabelText('open drawer');
    fireEvent.click(menuButton);

    // Check if drawer content is visible (there should be two instances now)
    const legalAIElements = screen.getAllByText('Legal AI');
    expect(legalAIElements).toHaveLength(2); // One in permanent drawer, one in mobile drawer
  });

  it('renders children content correctly', () => {
    const testContent = (
      <div>
        <h1>Test Page</h1>
        <p>This is test content</p>
      </div>
    );

    renderWithTheme(
      <AppLayout>{testContent}</AppLayout>
    );

    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.getByText('This is test content')).toBeInTheDocument();
  });

  it('includes account icon in app bar', () => {
    renderWithTheme(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    );

    // Check for account icon button (it should be present)
    const accountButton = screen.getByRole('button', { name: '' });
    expect(accountButton).toBeInTheDocument();
  });
});