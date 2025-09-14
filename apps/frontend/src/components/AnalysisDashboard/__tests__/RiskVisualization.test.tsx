import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../theme';
import { RiskVisualization, Risk } from '../RiskVisualization';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('RiskVisualization', () => {
  const mockRisks: Risk[] = [
    {
      category: 'financial',
      severity: 'high',
      description: 'High security deposit amount',
      affectedClause: 'Section 3',
      recommendation: 'Negotiate lower amount'
    },
    {
      category: 'legal',
      severity: 'medium',
      description: 'Broad liability clause',
      affectedClause: 'Section 8',
      recommendation: 'Request clarification'
    },
    {
      category: 'privacy',
      severity: 'low',
      description: 'Standard privacy terms',
      affectedClause: 'Section 12',
      recommendation: 'No action needed'
    }
  ];

  it('renders overall risk score correctly', () => {
    renderWithTheme(
      <RiskVisualization riskScore="high" risks={mockRisks} />
    );

    expect(screen.getByText('Overall Risk: high')).toBeInTheDocument();
    expect(screen.getByText('85% risk level detected')).toBeInTheDocument();
  });

  it('displays risk summary with correct counts', () => {
    renderWithTheme(
      <RiskVisualization riskScore="medium" risks={mockRisks} />
    );

    expect(screen.getByText('Risk Summary')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // High risk count
    expect(screen.getByText('High Risk')).toBeInTheDocument();
    expect(screen.getByText('Medium Risk')).toBeInTheDocument();
    expect(screen.getByText('Low Risk')).toBeInTheDocument();
  });

  it('renders individual risk items correctly', () => {
    renderWithTheme(
      <RiskVisualization riskScore="medium" risks={mockRisks} />
    );

    expect(screen.getByText('Identified Risks')).toBeInTheDocument();
    expect(screen.getByText('High security deposit amount')).toBeInTheDocument();
    expect(screen.getByText('Broad liability clause')).toBeInTheDocument();
    expect(screen.getByText('Standard privacy terms')).toBeInTheDocument();

    expect(screen.getByText('Affected Clause: Section 3')).toBeInTheDocument();
    expect(screen.getByText('Recommendation: Negotiate lower amount')).toBeInTheDocument();
  });

  it('handles empty risks array', () => {
    renderWithTheme(
      <RiskVisualization riskScore="low" risks={[]} />
    );

    expect(screen.getByText('Overall Risk: low')).toBeInTheDocument();
    expect(screen.getByText('Risk Summary')).toBeInTheDocument();
    expect(screen.queryByText('Identified Risks')).not.toBeInTheDocument();
  });

  it('displays correct risk percentages for different scores', () => {
    const { rerender } = renderWithTheme(
      <RiskVisualization riskScore="low" risks={[]} />
    );
    expect(screen.getByText('15% risk level detected')).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <RiskVisualization riskScore="medium" risks={[]} />
      </ThemeProvider>
    );
    expect(screen.getByText('50% risk level detected')).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <RiskVisualization riskScore="high" risks={[]} />
      </ThemeProvider>
    );
    expect(screen.getByText('85% risk level detected')).toBeInTheDocument();
  });
});