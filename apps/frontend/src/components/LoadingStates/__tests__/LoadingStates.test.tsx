/**
 * Unit tests for LoadingStates components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../theme';

import {
  DocumentProcessingLoader,
  AnalysisDashboardSkeleton,
  ChatLoading,
  ComparisonLoading,
} from '../LoadingStates';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('DocumentProcessingLoader', () => {
  it('renders with basic props', () => {
    renderWithTheme(
      <DocumentProcessingLoader
        currentStep="upload"
        progress={25}
      />
    );

    expect(screen.getByText('Processing Document')).toBeInTheDocument();
    expect(screen.getByText('25% complete')).toBeInTheDocument();
  });

  it('displays filename when provided', () => {
    renderWithTheme(
      <DocumentProcessingLoader
        currentStep="analyze"
        progress={75}
        fileName="test-document.pdf"
      />
    );

    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
  });

  it('shows correct step status for upload stage', () => {
    renderWithTheme(
      <DocumentProcessingLoader
        currentStep="upload"
        progress={10}
      />
    );

    expect(screen.getByText('Uploading document')).toBeInTheDocument();
    expect(screen.getByText('Extracting text content')).toBeInTheDocument();
    expect(screen.getByText('AI analysis in progress')).toBeInTheDocument();
    expect(screen.getByText('Analysis complete')).toBeInTheDocument();
  });

  it('shows correct step status for extract stage', () => {
    renderWithTheme(
      <DocumentProcessingLoader
        currentStep="extract"
        progress={50}
      />
    );

    // Upload should be completed, extract should be active
    expect(screen.getByText('Extracting text content')).toBeInTheDocument();
  });

  it('shows correct step status for analyze stage', () => {
    renderWithTheme(
      <DocumentProcessingLoader
        currentStep="analyze"
        progress={80}
      />
    );

    expect(screen.getByText('AI analysis in progress')).toBeInTheDocument();
  });

  it('shows correct step status for complete stage', () => {
    renderWithTheme(
      <DocumentProcessingLoader
        currentStep="complete"
        progress={100}
      />
    );

    expect(screen.getByText('Analysis complete')).toBeInTheDocument();
    expect(screen.getByText('100% complete')).toBeInTheDocument();
  });

  it('displays progress bar with correct value', () => {
    renderWithTheme(
      <DocumentProcessingLoader
        currentStep="analyze"
        progress={65}
      />
    );

    const progressBar = document.querySelector('.MuiLinearProgress-root');
    expect(progressBar).toBeInTheDocument();
    expect(screen.getByText('65% complete')).toBeInTheDocument();
  });
});

describe('AnalysisDashboardSkeleton', () => {
  it('renders skeleton elements', () => {
    renderWithTheme(<AnalysisDashboardSkeleton />);

    // Check for skeleton elements
    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders without chat skeleton by default', () => {
    const { container } = renderWithTheme(<AnalysisDashboardSkeleton />);
    
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(5); // Should have multiple skeleton elements
  });

  it('includes chat skeleton when showChat is true', () => {
    const { container } = renderWithTheme(<AnalysisDashboardSkeleton showChat={true} />);
    
    const skeletons = container.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(10); // Should have more skeleton elements with chat
  });

  it('renders main content skeleton structure', () => {
    renderWithTheme(<AnalysisDashboardSkeleton />);

    // Should have skeleton elements for different sections
    const textSkeletons = document.querySelectorAll('.MuiSkeleton-text');
    const rectangularSkeletons = document.querySelectorAll('.MuiSkeleton-rectangular');
    const circularSkeletons = document.querySelectorAll('.MuiSkeleton-circular');

    expect(textSkeletons.length).toBeGreaterThan(0);
    expect(rectangularSkeletons.length).toBeGreaterThan(0);
    expect(circularSkeletons.length).toBeGreaterThan(0);
  });
});

describe('ChatLoading', () => {
  it('renders with default message', () => {
    renderWithTheme(<ChatLoading />);

    expect(screen.getByText('Analyzing your question...')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    const customMessage = 'Processing your request...';
    renderWithTheme(<ChatLoading message={customMessage} />);

    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('displays loading spinner', () => {
    renderWithTheme(<ChatLoading />);

    const spinner = document.querySelector('.MuiCircularProgress-root');
    expect(spinner).toBeInTheDocument();
  });

  it('displays bot avatar', () => {
    renderWithTheme(<ChatLoading />);

    // Check for bot icon in avatar
    const botIcon = document.querySelector('[data-testid="PsychologyIcon"]');
    expect(botIcon).toBeInTheDocument();
  });
});

describe('ComparisonLoading', () => {
  it('renders with uploading stage', () => {
    renderWithTheme(
      <ComparisonLoading stage="uploading" progress={25} />
    );

    expect(screen.getByText('Uploading comparison document...')).toBeInTheDocument();
    expect(screen.getByText('25% complete')).toBeInTheDocument();
  });

  it('renders with processing stage', () => {
    renderWithTheme(
      <ComparisonLoading stage="processing" progress={50} />
    );

    expect(screen.getByText('Processing document content...')).toBeInTheDocument();
    expect(screen.getByText('50% complete')).toBeInTheDocument();
  });

  it('renders with comparing stage', () => {
    renderWithTheme(
      <ComparisonLoading stage="comparing" progress={75} />
    );

    expect(screen.getByText('Comparing document versions...')).toBeInTheDocument();
    expect(screen.getByText('75% complete')).toBeInTheDocument();
  });

  it('renders with analyzing stage', () => {
    renderWithTheme(
      <ComparisonLoading stage="analyzing" progress={90} />
    );

    expect(screen.getByText('Analyzing changes and impact...')).toBeInTheDocument();
    expect(screen.getByText('90% complete')).toBeInTheDocument();
  });

  it('displays progress bar with correct value', () => {
    renderWithTheme(
      <ComparisonLoading stage="comparing" progress={60} />
    );

    const progressBar = document.querySelector('.MuiLinearProgress-root');
    expect(progressBar).toBeInTheDocument();
    expect(screen.getByText('60% complete')).toBeInTheDocument();
  });

  it('displays loading spinner', () => {
    renderWithTheme(
      <ComparisonLoading stage="analyzing" progress={80} />
    );

    const spinner = document.querySelector('.MuiCircularProgress-root');
    expect(spinner).toBeInTheDocument();
  });

  it('handles zero progress', () => {
    renderWithTheme(
      <ComparisonLoading stage="uploading" progress={0} />
    );

    expect(screen.getByText('0% complete')).toBeInTheDocument();
  });

  it('handles full progress', () => {
    renderWithTheme(
      <ComparisonLoading stage="analyzing" progress={100} />
    );

    expect(screen.getByText('100% complete')).toBeInTheDocument();
  });

  it('rounds progress values correctly', () => {
    renderWithTheme(
      <ComparisonLoading stage="processing" progress={33.7} />
    );

    expect(screen.getByText('34% complete')).toBeInTheDocument();
  });
});

describe('Loading States Accessibility', () => {
  it('DocumentProcessingLoader has proper ARIA labels', () => {
    renderWithTheme(
      <DocumentProcessingLoader
        currentStep="analyze"
        progress={75}
        fileName="test.pdf"
      />
    );

    const progressBar = document.querySelector('.MuiLinearProgress-root');
    expect(progressBar).toHaveAttribute('role', 'progressbar');
  });

  it('ComparisonLoading has proper ARIA labels', () => {
    renderWithTheme(
      <ComparisonLoading stage="analyzing" progress={50} />
    );

    const progressBar = document.querySelector('.MuiLinearProgress-root');
    expect(progressBar).toHaveAttribute('role', 'progressbar');
  });

  it('ChatLoading has proper structure for screen readers', () => {
    renderWithTheme(<ChatLoading message="Loading response..." />);

    // Should have text content that screen readers can announce
    expect(screen.getByText('Loading response...')).toBeInTheDocument();
  });
});

describe('Loading States Performance', () => {
  it('renders quickly without performance issues', () => {
    const startTime = performance.now();
    
    renderWithTheme(
      <DocumentProcessingLoader
        currentStep="analyze"
        progress={50}
        fileName="large-document.pdf"
      />
    );
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // Should render in less than 100ms
    expect(renderTime).toBeLessThan(100);
  });

  it('handles rapid progress updates efficiently', () => {
    const { rerender } = renderWithTheme(
      <ComparisonLoading stage="processing" progress={0} />
    );

    // Simulate rapid progress updates
    for (let i = 10; i <= 100; i += 10) {
      rerender(
        <ThemeProvider theme={theme}>
          <ComparisonLoading stage="processing" progress={i} />
        </ThemeProvider>
      );
    }

    expect(screen.getByText('100% complete')).toBeInTheDocument();
  });
});