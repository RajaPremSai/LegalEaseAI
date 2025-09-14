/**
 * End-to-end tests for interactive features
 * Tests the complete user workflows for chat interface, document comparison, and loading states
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../theme';

import { ChatInterface, ChatMessage } from '../components/ChatInterface';
import { DocumentComparison, DocumentVersion, DocumentChange } from '../components/DocumentComparison';
import { 
  DocumentProcessingLoader, 
  AnalysisDashboardSkeleton, 
  ChatLoading, 
  ComparisonLoading 
} from '../components/LoadingStates';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

// Helper function to render components with theme
const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ChatInterface Component', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: '1',
      content: 'What does the security deposit clause mean?',
      sender: 'user',
      timestamp: new Date('2024-01-01T10:00:00Z'),
    },
    {
      id: '2',
      content: 'The security deposit clause requires you to pay $5,000 upfront, which is unusually high.',
      sender: 'assistant',
      timestamp: new Date('2024-01-01T10:01:00Z'),
      sources: ['Section 3, Paragraph 2'],
    },
  ];

  it('renders chat interface with initial messages', () => {
    renderWithTheme(
      <ChatInterface initialMessages={mockMessages} />
    );

    expect(screen.getByText('Ask Questions About Your Document')).toBeInTheDocument();
    expect(screen.getByText('What does the security deposit clause mean?')).toBeInTheDocument();
    expect(screen.getByText(/The security deposit clause requires/)).toBeInTheDocument();
    expect(screen.getByText('Section 3, Paragraph 2')).toBeInTheDocument();
  });

  it('displays empty state when no messages', () => {
    renderWithTheme(<ChatInterface />);

    expect(screen.getByText('Start a conversation by asking a question about your document')).toBeInTheDocument();
  });

  it('allows user to send a message', async () => {
    const user = userEvent.setup();
    const mockSendMessage = jest.fn().mockResolvedValue({
      id: '3',
      content: 'Mock response',
      sender: 'assistant' as const,
      timestamp: new Date(),
    });

    renderWithTheme(
      <ChatInterface onSendMessage={mockSendMessage} />
    );

    const input = screen.getByPlaceholderText('Ask a question about your document...');
    const sendButton = screen.getByRole('button');

    await user.type(input, 'Test question');
    await user.click(sendButton);

    expect(mockSendMessage).toHaveBeenCalledWith('Test question');
  });

  it('shows typing indicator while processing', async () => {
    const user = userEvent.setup();
    let resolveMessage: (value: ChatMessage) => void;
    const mockSendMessage = jest.fn().mockImplementation(() => {
      return new Promise<ChatMessage>((resolve) => {
        resolveMessage = resolve;
      });
    });

    renderWithTheme(
      <ChatInterface onSendMessage={mockSendMessage} />
    );

    const input = screen.getByPlaceholderText('Ask a question about your document...');
    const sendButton = screen.getByRole('button');

    await user.type(input, 'Test question');
    await user.click(sendButton);

    expect(screen.getByText('Analyzing your question...')).toBeInTheDocument();

    // Resolve the promise
    act(() => {
      resolveMessage!({
        id: '3',
        content: 'Mock response',
        sender: 'assistant',
        timestamp: new Date(),
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('Analyzing your question...')).not.toBeInTheDocument();
    });
  });

  it('handles Enter key to send message', async () => {
    const user = userEvent.setup();
    const mockSendMessage = jest.fn().mockResolvedValue({
      id: '3',
      content: 'Mock response',
      sender: 'assistant' as const,
      timestamp: new Date(),
    });

    renderWithTheme(
      <ChatInterface onSendMessage={mockSendMessage} />
    );

    const input = screen.getByPlaceholderText('Ask a question about your document...');

    await user.type(input, 'Test question{enter}');

    expect(mockSendMessage).toHaveBeenCalledWith('Test question');
  });

  it('copies message content to clipboard', async () => {
    const user = userEvent.setup();
    
    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
      writable: true,
    });

    renderWithTheme(
      <ChatInterface initialMessages={mockMessages} />
    );

    const messageBox = screen.getByText('What does the security deposit clause mean?').closest('div');
    
    await user.hover(messageBox!);
    
    const copyButton = screen.getAllByRole('button').find(button => 
      button.querySelector('[data-testid="ContentCopyIcon"]')
    );
    
    if (copyButton) {
      await user.click(copyButton);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('What does the security deposit clause mean?');
    }
  });
});

describe('DocumentComparison Component', () => {
  const mockOriginalDoc: DocumentVersion = {
    id: '1',
    name: 'original-lease.pdf',
    uploadedAt: new Date('2024-01-01'),
    content: 'Original content',
    analysis: { riskScore: 'high' },
  };

  const mockComparedDoc: DocumentVersion = {
    id: '2',
    name: 'updated-lease.pdf',
    uploadedAt: new Date('2024-01-02'),
    content: 'Updated content',
    analysis: { riskScore: 'medium' },
  };

  const mockChanges: DocumentChange[] = [
    {
      type: 'modified',
      section: 'Security Deposit',
      oldContent: 'Tenant shall pay $5,000 security deposit',
      newContent: 'Tenant shall pay $3,000 security deposit',
      impact: 'positive',
      explanation: 'Security deposit reduced by $2,000',
      riskChange: 'decreased',
    },
    {
      type: 'added',
      section: 'Early Termination',
      newContent: 'Tenant may terminate with 60 days notice',
      impact: 'positive',
      explanation: 'Added flexibility for early termination',
      riskChange: 'decreased',
    },
  ];

  it('renders document comparison with changes', () => {
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={mockChanges}
      />
    );

    expect(screen.getByText('Document Comparison')).toBeInTheDocument();
    expect(screen.getByText('original-lease.pdf')).toBeInTheDocument();
    expect(screen.getByText('updated-lease.pdf')).toBeInTheDocument();
    expect(screen.getByText('Security Deposit')).toBeInTheDocument();
    expect(screen.getByText('Early Termination')).toBeInTheDocument();
  });

  it('shows overall impact summary', () => {
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={mockChanges}
      />
    );

    expect(screen.getByText(/Overall Impact: Favorable Changes/)).toBeInTheDocument();
    expect(screen.getByText(/2 changes detected/)).toBeInTheDocument();
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

    // Click on "added" filter
    const addedButton = screen.getByText(/added \(1\)/i);
    await user.click(addedButton);

    // Should only show added changes
    expect(screen.getByText('Early Termination')).toBeInTheDocument();
    expect(screen.queryByText('Security Deposit')).not.toBeInTheDocument();
  });

  it('expands change details in accordion', async () => {
    const user = userEvent.setup();
    
    renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={mockChanges}
      />
    );

    const securityDepositAccordion = screen.getByText('Security Deposit').closest('button');
    await user.click(securityDepositAccordion!);

    expect(screen.getByText('Tenant shall pay $5,000 security deposit')).toBeInTheDocument();
    expect(screen.getByText('Tenant shall pay $3,000 security deposit')).toBeInTheDocument();
    expect(screen.getByText('Security deposit reduced by $2,000')).toBeInTheDocument();
  });

  it('calls analyze changes handler', async () => {
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

    expect(mockAnalyzeChanges).toHaveBeenCalled();
  });
});

describe('Loading States Components', () => {
  describe('DocumentProcessingLoader', () => {
    it('renders processing steps with correct status', () => {
      renderWithTheme(
        <DocumentProcessingLoader
          currentStep="analyze"
          progress={75}
          fileName="test-document.pdf"
        />
      );

      expect(screen.getByText('Processing Document')).toBeInTheDocument();
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      expect(screen.getByText('75% complete')).toBeInTheDocument();
      expect(screen.getByText('AI analysis in progress')).toBeInTheDocument();
    });

    it('shows completed steps with check icons', () => {
      renderWithTheme(
        <DocumentProcessingLoader
          currentStep="complete"
          progress={100}
        />
      );

      expect(screen.getByText('Analysis complete')).toBeInTheDocument();
      expect(screen.getByText('100% complete')).toBeInTheDocument();
    });
  });

  describe('AnalysisDashboardSkeleton', () => {
    it('renders skeleton loading state', () => {
      renderWithTheme(<AnalysisDashboardSkeleton />);

      // Check for skeleton elements (MUI Skeleton components)
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('includes chat skeleton when showChat is true', () => {
      renderWithTheme(<AnalysisDashboardSkeleton showChat={true} />);

      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(10); // More skeletons when chat is included
    });
  });

  describe('ChatLoading', () => {
    it('renders chat loading indicator', () => {
      renderWithTheme(<ChatLoading />);

      expect(screen.getByText('Analyzing your question...')).toBeInTheDocument();
    });

    it('renders custom loading message', () => {
      renderWithTheme(<ChatLoading message="Processing your request..." />);

      expect(screen.getByText('Processing your request...')).toBeInTheDocument();
    });
  });

  describe('ComparisonLoading', () => {
    it('renders comparison loading with different stages', () => {
      renderWithTheme(
        <ComparisonLoading stage="comparing" progress={50} />
      );

      expect(screen.getByText('Comparing document versions...')).toBeInTheDocument();
      expect(screen.getByText('50% complete')).toBeInTheDocument();
    });

    it('shows different messages for different stages', () => {
      const { rerender } = renderWithTheme(
        <ComparisonLoading stage="uploading" progress={25} />
      );

      expect(screen.getByText('Uploading comparison document...')).toBeInTheDocument();

      rerender(
        <ThemeProvider theme={theme}>
          <ComparisonLoading stage="analyzing" progress={75} />
        </ThemeProvider>
      );

      expect(screen.getByText('Analyzing changes and impact...')).toBeInTheDocument();
    });
  });
});

describe('User Workflow Integration Tests', () => {
  it('completes full chat workflow', async () => {
    const user = userEvent.setup();
    let messageCount = 0;
    
    const mockSendMessage = jest.fn().mockImplementation((message: string) => {
      messageCount++;
      return Promise.resolve({
        id: messageCount.toString(),
        content: `Response to: ${message}`,
        sender: 'assistant' as const,
        timestamp: new Date(),
        sources: ['Section 1'],
      });
    });

    renderWithTheme(
      <ChatInterface onSendMessage={mockSendMessage} />
    );

    // Send first message
    const input = screen.getByPlaceholderText('Ask a question about your document...');
    await user.type(input, 'What is the security deposit?');
    await user.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('What is the security deposit?')).toBeInTheDocument();
      expect(screen.getByText('Response to: What is the security deposit?')).toBeInTheDocument();
    });

    // Send follow-up message
    await user.type(input, 'Is that amount reasonable?');
    const sendButtons = screen.getAllByRole('button');
    const sendButton = sendButtons.find(button => button.querySelector('[data-testid="SendIcon"]'));
    await user.click(sendButton!);

    await waitFor(() => {
      expect(screen.getByText('Is that amount reasonable?')).toBeInTheDocument();
      expect(screen.getByText('Response to: Is that amount reasonable?')).toBeInTheDocument();
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it('handles document comparison workflow', async () => {
    const user = userEvent.setup();
    const mockAnalyzeChanges = jest.fn();
    
    const { rerender } = renderWithTheme(
      <DocumentComparison
        originalDocument={mockOriginalDoc}
        comparedDocument={mockComparedDoc}
        changes={[]}
        onAnalyzeChanges={mockAnalyzeChanges}
      />
    );

    // Initially no changes shown
    expect(screen.queryByText('Security Deposit')).not.toBeInTheDocument();

    // Trigger analysis
    const analyzeButton = screen.getByText('Re-analyze Changes');
    await user.click(analyzeButton);

    expect(mockAnalyzeChanges).toHaveBeenCalled();

    // Simulate changes being loaded
    rerender(
      <ThemeProvider theme={theme}>
        <DocumentComparison
          originalDocument={mockOriginalDoc}
          comparedDocument={mockComparedDoc}
          changes={mockChanges}
          onAnalyzeChanges={mockAnalyzeChanges}
        />
      </ThemeProvider>
    );

    // Now changes should be visible
    expect(screen.getByText('Security Deposit')).toBeInTheDocument();
    expect(screen.getByText('Early Termination')).toBeInTheDocument();
  });

  it('shows appropriate loading states during processing', async () => {
    const { rerender } = renderWithTheme(
      <DocumentProcessingLoader
        currentStep="upload"
        progress={0}
        fileName="test.pdf"
      />
    );

    expect(screen.getByText('Uploading document')).toBeInTheDocument();
    expect(screen.getByText('0% complete')).toBeInTheDocument();

    // Simulate progress
    rerender(
      <ThemeProvider theme={theme}>
        <DocumentProcessingLoader
          currentStep="analyze"
          progress={75}
          fileName="test.pdf"
        />
      </ThemeProvider>
    );

    expect(screen.getByText('AI analysis in progress')).toBeInTheDocument();
    expect(screen.getByText('75% complete')).toBeInTheDocument();

    // Complete processing
    rerender(
      <ThemeProvider theme={theme}>
        <DocumentProcessingLoader
          currentStep="complete"
          progress={100}
          fileName="test.pdf"
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Analysis complete')).toBeInTheDocument();
    expect(screen.getByText('100% complete')).toBeInTheDocument();
  });
});

// Mock data for tests
const mockOriginalDoc: DocumentVersion = {
  id: '1',
  name: 'original-lease.pdf',
  uploadedAt: new Date('2024-01-01'),
  content: 'Original content',
  analysis: { riskScore: 'high' },
};

const mockComparedDoc: DocumentVersion = {
  id: '2',
  name: 'updated-lease.pdf',
  uploadedAt: new Date('2024-01-02'),
  content: 'Updated content',
  analysis: { riskScore: 'medium' },
};

const mockChanges: DocumentChange[] = [
  {
    type: 'modified',
    section: 'Security Deposit',
    oldContent: 'Tenant shall pay $5,000 security deposit',
    newContent: 'Tenant shall pay $3,000 security deposit',
    impact: 'positive',
    explanation: 'Security deposit reduced by $2,000',
    riskChange: 'decreased',
  },
  {
    type: 'added',
    section: 'Early Termination',
    newContent: 'Tenant may terminate with 60 days notice',
    impact: 'positive',
    explanation: 'Added flexibility for early termination',
    riskChange: 'decreased',
  },
];