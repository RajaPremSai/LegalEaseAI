import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../theme';
import { AnalysisDashboard, DocumentAnalysis } from '../AnalysisDashboard';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('AnalysisDashboard', () => {
  const mockAnalysis: DocumentAnalysis = {
    summary: 'This is a test document summary with key information.',
    riskScore: 'medium',
    keyTerms: [
      {
        term: 'Security Deposit',
        definition: 'A refundable amount paid upfront.',
        importance: 'high',
        location: 'Section 3'
      },
      {
        term: 'Normal Wear',
        definition: 'Expected deterioration from regular use.',
        importance: 'medium',
        location: 'Section 7'
      }
    ],
    risks: [
      {
        category: 'financial',
        severity: 'high',
        description: 'High deposit amount',
        affectedClause: 'Section 3',
        recommendation: 'Negotiate lower'
      }
    ],
    recommendations: [
      'Review the security deposit clause carefully',
      'Consider negotiating payment terms'
    ],
    clauses: [
      {
        id: '1',
        title: 'Security Deposit',
        content: 'Tenant shall pay security deposit...',
        riskLevel: 'high',
        explanation: 'This clause requires careful attention.'
      },
      {
        id: '2',
        title: 'Maintenance',
        content: 'Tenant is responsible for maintenance...',
        riskLevel: 'medium',
        explanation: 'Standard maintenance clause.'
      }
    ],
    generatedAt: new Date('2024-01-15')
  };

  it('renders document analysis header correctly', () => {
    renderWithTheme(
      <AnalysisDashboard
        analysis={mockAnalysis}
        documentName="test-contract.pdf"
      />
    );

    expect(screen.getByText('Document Analysis')).toBeInTheDocument();
    expect(screen.getByText('test-contract.pdf')).toBeInTheDocument();
    expect(screen.getByText('Analyzed on 1/15/2024')).toBeInTheDocument();
  });

  it('displays document summary', () => {
    renderWithTheme(
      <AnalysisDashboard
        analysis={mockAnalysis}
        documentName="test-contract.pdf"
      />
    );

    expect(screen.getByText('Document Summary')).toBeInTheDocument();
    expect(screen.getByText('This is a test document summary with key information.')).toBeInTheDocument();
  });

  it('renders key terms section', () => {
    renderWithTheme(
      <AnalysisDashboard
        analysis={mockAnalysis}
        documentName="test-contract.pdf"
      />
    );

    expect(screen.getByText('Key Terms & Definitions')).toBeInTheDocument();
    expect(screen.getByText('Security Deposit')).toBeInTheDocument();
    expect(screen.getByText('Normal Wear')).toBeInTheDocument();
  });

  it('displays document clauses analysis', () => {
    renderWithTheme(
      <AnalysisDashboard
        analysis={mockAnalysis}
        documentName="test-contract.pdf"
      />
    );

    expect(screen.getByText('Document Clauses Analysis')).toBeInTheDocument();
    expect(screen.getByText('Security Deposit')).toBeInTheDocument();
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
    expect(screen.getByText('high risk')).toBeInTheDocument();
    expect(screen.getByText('medium risk')).toBeInTheDocument();
  });

  it('shows recommendations section', () => {
    renderWithTheme(
      <AnalysisDashboard
        analysis={mockAnalysis}
        documentName="test-contract.pdf"
      />
    );

    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Review the security deposit clause carefully')).toBeInTheDocument();
    expect(screen.getByText('Consider negotiating payment terms')).toBeInTheDocument();
  });

  it('includes risk visualization component', () => {
    renderWithTheme(
      <AnalysisDashboard
        analysis={mockAnalysis}
        documentName="test-contract.pdf"
      />
    );

    expect(screen.getByText('Overall Risk: medium')).toBeInTheDocument();
    expect(screen.getByText('Risk Summary')).toBeInTheDocument();
  });

  it('handles empty arrays gracefully', () => {
    const emptyAnalysis: DocumentAnalysis = {
      ...mockAnalysis,
      keyTerms: [],
      risks: [],
      recommendations: [],
      clauses: []
    };

    renderWithTheme(
      <AnalysisDashboard
        analysis={emptyAnalysis}
        documentName="empty-contract.pdf"
      />
    );

    expect(screen.getByText('Document Analysis')).toBeInTheDocument();
    expect(screen.getByText('Document Summary')).toBeInTheDocument();
    expect(screen.getByText('Key Terms & Definitions')).toBeInTheDocument();
  });
});