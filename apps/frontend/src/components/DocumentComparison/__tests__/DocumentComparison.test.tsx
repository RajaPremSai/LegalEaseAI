/**
 * Unit tests for DocumentComparison component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../theme';

import { DocumentComparison, DocumentVersion, DocumentChange } from '../DocumentComparison';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('DocumentComparison', () => {
  const mockOriginalDoc: DocumentVersion = {
    id: '1',
    name: 'lease-v1.pdf',
    uploadedAt: new Date('2024-01-01'),
    content: 'Original lease content',
    analysis: {
      riskScore: 'high',
      keyChanges: [],
    },
  };

  const mockComparedDoc: DocumentVersion = {
    id: '2',
    name: 'lease-v2.pdf',
    uploadedAt: new Date('2024-01-15'),
    content: 'Updated lease content',
    analysis: {
      riskScore: 'medium',
      keyChanges: ['Security deposit reduced', 'Added termination clause'],
    },
  };

  const mockChanges: DocumentChange[] = [
    {
      type: 'modified',
      section: 'Security Deposit',
      oldContent: 'Security deposit: $5,000',
      newContent: 'Security deposit: $3,000',
      impact: 'positive',
      explanation: 'Reduced security deposit makes the lease more affordable',
      riskChange: 'decreased',
    },
    {
      type: 'added',
      section: 'Early Termination',
      newContent: 'Tenant may terminate lease with 60 days notice',
      impact: 'positive',
      explanation: 'Provides flexibility for tenant to exit lease early',
      riskChange: 'decreased',
    },
    {
      type: 'removed',
      section: 'Pet Restrictions',
      oldContent: 'No pets allowed under any circumstances',
      impact: 'neutral',
      explanation: 'Pet restriction clause removed, allowing pets',
      riskChange: 'unchanged',
    },
    {
      type: 'modified',
      section: 'Late Fees',
      oldContent: 'Late fee: $100 per day',
      newContent: 'Late fee: $200 per day',
      impact: 'negative',
      explanation: 'Late fees increased significantly',
      riskChange: 'increased',
    },
  ];

  it('renders without crashing', () => {
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
      />
    );

    expect(screen.getByText('Document Comparison')).toBeInTheDocument();
  });

  it('displays document information correctly', () => {
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
      />
    );

    expect(screen.getByText('lease-v1.pdf')).toBeInTheDocument();
    expect(screen.getByText('lease-v2.pdf')).toBeInTheDocument();
    expect(screen.getByText('high risk')).toBeInTheDocument();
    expect(screen.getByText('medium risk')).toBeInTheDocument();
  });

  it('shows overall impact summary', () => {
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={mockChanges}
      />
    );

    expect(screen.getByText(/4 changes detected/)).toBeInTheDocument();
    expect(screen.getByText(/2 positive/)).toBeInTheDocument();
    expect(screen.getByText(/1 negative/)).toBeInTheDocument();
    expect(screen.getByText(/1 neutral/)).toBeInTheDocument();
  });

  it('displays all change types correctly', () => {
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={mockChanges}
      />
    );

    expect(screen.getByText('Security Deposit')).toBeInTheDocument();
    expect(screen.getByText('Early Termination')).toBeInTheDocument();
    expect(screen.getByText('Pet Restrictions')).toBeInTheDocument();
    expect(screen.getByText('Late Fees')).toBeInTheDocument();
  });

  it('filters changes by type', async () => {
    const user = userEvent.setup();
    
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={mockChanges}
      />
    );

    // Filter by 'added' changes
    const addedButton = screen.getByText(/added \(1\)/i);
    await user.click(addedButton);

    // Should only show added changes
    expect(screen.getByText('Early Termination')).toBeInTheDocument();
    expect(screen.queryByText('Security Deposit')).not.toBeInTheDocument();
    expect(screen.queryByText('Pet Restrictions')).not.toBeInTheDocument();
    expect(screen.queryByText('Late Fees')).not.toBeInTheDocument();
  });

  it('filters changes by modified type', async () => {
    const user = userEvent.setup();
    
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={mockChanges}
      />
    );

    // Filter by 'modified' changes
    const modifiedButton = screen.getByText(/modified \(2\)/i);
    await user.click(modifiedButton);

    // Should show both modified changes
    expect(screen.getByText('Security Deposit')).toBeInTheDocument();
    expect(screen.getByText('Late Fees')).toBeInTheDocument();
    expect(screen.queryByText('Early Termination')).not.toBeInTheDocument();
    expect(screen.queryByText('Pet Restrictions')).not.toBeInTheDocument();
  });

  it('expands accordion to show change details', async () => {
    const user = userEvent.setup();
    
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={mockChanges}
      />
    );

    // Click on Security Deposit accordion
    const securityDepositAccordion = screen.getByText('Security Deposit').closest('button');
    await user.click(securityDepositAccordion!);

    // Should show detailed content
    expect(screen.getByText('Security deposit: $5,000')).toBeInTheDocument();
    expect(screen.getByText('Security deposit: $3,000')).toBeInTheDocument();
    expect(screen.getByText('Reduced security deposit makes the lease more affordable')).toBeInTheDocument();
  });

  it('shows appropriate chips for change types and impacts', () => {
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={mockChanges}
      />
    );

    // Check for change type chips (there are multiple 'modified' chips, so use getAllByText)
    expect(screen.getAllByText('modified')).toHaveLength(2);
    expect(screen.getByText('added')).toBeInTheDocument();
    expect(screen.getByText('removed')).toBeInTheDocument();

    // Check for risk change chips
    expect(screen.getAllByText('Risk decreased')).toHaveLength(2);
    expect(screen.getByText('Risk increased')).toBeInTheDocument();
  });

  it('handles show only changes toggle', async () => {
    const user = userEvent.setup();
    
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={mockChanges}
      />
    );

    const toggleSwitch = screen.getByRole('checkbox', { name: /show only changes/i });
    
    // Should be checked by default
    expect(toggleSwitch).toBeChecked();

    // Toggle off
    await user.click(toggleSwitch);
    expect(toggleSwitch).not.toBeChecked();
  });

  it('calls analyze changes handler when button is clicked', async () => {
    const user = userEvent.setup();
    const mockAnalyzeChanges = jest.fn();
    
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={mockChanges}
        onAnalyzeChanges={mockAnalyzeChanges}
      />
    );

    const analyzeButton = screen.getByText('Re-analyze Changes');
    await user.click(analyzeButton);

    expect(mockAnalyzeChanges).toHaveBeenCalledTimes(1);
  });

  it('disables analyze button when analyzing', () => {
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={mockChanges}
        onAnalyzeChanges={jest.fn()}
        isAnalyzing={true}
      />
    );

    const analyzeButton = screen.getByText('Analyzing...');
    expect(analyzeButton).toBeDisabled();
  });

  it('shows no changes message when filtered results are empty', async () => {
    const user = userEvent.setup();
    
    // Only provide changes of one type
    const limitedChanges = mockChanges.filter(change => change.type === 'added');
    
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={limitedChanges}
      />
    );

    // Filter by 'removed' changes (which don't exist in limitedChanges)
    const removedButton = screen.getByText(/removed \(0\)/i);
    await user.click(removedButton);

    expect(screen.getByText('No changes found for the selected filter.')).toBeInTheDocument();
  });

  it('displays correct overall impact based on change types', () => {
    // Test with mostly positive changes
    const positiveChanges = mockChanges.filter(change => change.impact === 'positive');
    
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={positiveChanges}
      />
    );

    expect(screen.getByText(/Overall Impact: Favorable Changes/)).toBeInTheDocument();
  });

  it('handles empty changes array', () => {
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={[]}
      />
    );

    // Should show 0 changes when empty array is passed
    expect(screen.getByText(/Detected Changes/)).toBeInTheDocument();
    expect(screen.getByText(/0 changes detected/)).toBeInTheDocument();
  });

  it('shows correct change counts in filter buttons', () => {
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={mockChanges}
      />
    );

    expect(screen.getByText(/All Changes/)).toBeInTheDocument();
    expect(screen.getByText(/added \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/removed \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/modified \(2\)/i)).toBeInTheDocument();
  });

  it('displays document upload dates correctly', () => {
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={mockChanges}
      />
    );

    expect(screen.getByText(/Uploaded:.*1\/1\/2024/)).toBeInTheDocument();
    expect(screen.getByText(/Uploaded:.*15\/1\/2024/)).toBeInTheDocument();
  });
});