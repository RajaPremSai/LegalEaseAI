/**
 * Unit tests for ChatInterface component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../theme';

import { ChatInterface, ChatMessage } from '../ChatInterface';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ChatInterface', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: '1',
      content: 'Hello, I have a question about my lease.',
      sender: 'user',
      timestamp: new Date('2024-01-01T10:00:00Z'),
    },
    {
      id: '2',
      content: 'I\'d be happy to help you understand your lease. What specific section would you like me to explain?',
      sender: 'assistant',
      timestamp: new Date('2024-01-01T10:01:00Z'),
      sources: ['General Information'],
    },
  ];

  it('renders without crashing', () => {
    renderWithTheme(<ChatInterface />);
    expect(screen.getByText('Ask Questions About Your Document')).toBeInTheDocument();
  });

  it('displays initial messages correctly', () => {
    renderWithTheme(<ChatInterface initialMessages={mockMessages} />);
    
    expect(screen.getByText('Hello, I have a question about my lease.')).toBeInTheDocument();
    expect(screen.getByText(/I'd be happy to help you understand/)).toBeInTheDocument();
    expect(screen.getByText('General Information')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    renderWithTheme(<ChatInterface />);
    
    expect(screen.getByText('Start a conversation by asking a question about your document')).toBeInTheDocument();
  });

  it('handles message input and submission', async () => {
    const user = userEvent.setup();
    const mockSendMessage = jest.fn().mockResolvedValue({
      id: '3',
      content: 'Thank you for your question.',
      sender: 'assistant' as const,
      timestamp: new Date(),
    });

    renderWithTheme(<ChatInterface onSendMessage={mockSendMessage} />);

    const input = screen.getByPlaceholderText('Ask a question about your document...');
    const sendButton = screen.getByRole('button');

    // Type message
    await user.type(input, 'What does clause 5 mean?');
    expect(input).toHaveValue('What does clause 5 mean?');

    // Send message
    await user.click(sendButton);

    expect(mockSendMessage).toHaveBeenCalledWith('What does clause 5 mean?');
    expect(input).toHaveValue(''); // Input should be cleared
  });

  it('handles Enter key submission', async () => {
    const user = userEvent.setup();
    const mockSendMessage = jest.fn().mockResolvedValue({
      id: '3',
      content: 'Response',
      sender: 'assistant' as const,
      timestamp: new Date(),
    });

    renderWithTheme(<ChatInterface onSendMessage={mockSendMessage} />);

    const input = screen.getByPlaceholderText('Ask a question about your document...');

    await user.type(input, 'Test message');
    await user.keyboard('{Enter}');

    expect(mockSendMessage).toHaveBeenCalledWith('Test message');
  });

  it('prevents submission of empty messages', async () => {
    const mockSendMessage = jest.fn();

    renderWithTheme(<ChatInterface onSendMessage={mockSendMessage} />);

    const sendButton = screen.getByRole('button');

    // Button should be disabled when input is empty
    expect(sendButton).toBeDisabled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('disables input during typing state', async () => {
    const user = userEvent.setup();
    let resolveMessage: (value: ChatMessage) => void;
    const mockSendMessage = jest.fn().mockImplementation(() => {
      return new Promise<ChatMessage>((resolve) => {
        resolveMessage = resolve;
      });
    });

    renderWithTheme(<ChatInterface onSendMessage={mockSendMessage} />);

    const input = screen.getByPlaceholderText('Ask a question about your document...');
    
    await user.type(input, 'Test message');
    
    // Get the send button after typing (it should be enabled now)
    const sendButton = screen.getByRole('button');
    expect(sendButton).not.toBeDisabled();
    
    await user.click(sendButton);

    // Input and button should be disabled during processing
    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();

    // Resolve the promise
    act(() => {
      resolveMessage!({
        id: '3',
        content: 'Response',
        sender: 'assistant',
        timestamp: new Date(),
      });
    });

    await waitFor(() => {
      expect(input).not.toBeDisabled();
    });
  });

  it('shows typing indicator during message processing', async () => {
    const user = userEvent.setup();
    let resolveMessage: (value: ChatMessage) => void;
    const mockSendMessage = jest.fn().mockImplementation(() => {
      return new Promise<ChatMessage>((resolve) => {
        resolveMessage = resolve;
      });
    });

    renderWithTheme(<ChatInterface onSendMessage={mockSendMessage} />);

    const input = screen.getByPlaceholderText('Ask a question about your document...');
    const sendButton = screen.getByRole('button');

    await user.type(input, 'Test message');
    await user.click(sendButton);

    // Should show typing indicator
    expect(screen.getByText('Analyzing your question...')).toBeInTheDocument();

    // Resolve the promise
    resolveMessage!({
      id: '3',
      content: 'Response',
      sender: 'assistant',
      timestamp: new Date(),
    });

    await waitFor(() => {
      expect(screen.queryByText('Analyzing your question...')).not.toBeInTheDocument();
    });
  });

  it('displays message timestamps correctly', () => {
    const testDate = new Date('2024-01-01T14:30:00Z');
    const messageWithTime: ChatMessage = {
      id: '1',
      content: 'Test message',
      sender: 'user',
      timestamp: testDate,
    };

    renderWithTheme(<ChatInterface initialMessages={[messageWithTime]} />);

    // Should display formatted time - check for the presence of time text
    const timeElements = screen.getAllByText(/\d{1,2}:\d{2}/);
    expect(timeElements.length).toBeGreaterThan(0);
  });

  it('displays source citations for assistant messages', () => {
    const messageWithSources: ChatMessage = {
      id: '1',
      content: 'Based on your document...',
      sender: 'assistant',
      timestamp: new Date(),
      sources: ['Section 3.1', 'Clause 5.2', 'Appendix A'],
    };

    renderWithTheme(<ChatInterface initialMessages={[messageWithSources]} />);

    expect(screen.getByText('Section 3.1')).toBeInTheDocument();
    expect(screen.getByText('Clause 5.2')).toBeInTheDocument();
    expect(screen.getByText('Appendix A')).toBeInTheDocument();
  });

  it('handles multiline messages correctly', async () => {
    const user = userEvent.setup();
    const mockSendMessage = jest.fn().mockResolvedValue({
      id: '3',
      content: 'Response',
      sender: 'assistant' as const,
      timestamp: new Date(),
    });

    renderWithTheme(<ChatInterface onSendMessage={mockSendMessage} />);

    const input = screen.getByPlaceholderText('Ask a question about your document...');

    // Type multiline message using Shift+Enter
    await user.type(input, 'Line 1{Shift>}{Enter}{/Shift}Line 2');
    expect(input).toHaveValue('Line 1\nLine 2');

    // Send with Enter
    await user.keyboard('{Enter}');

    expect(mockSendMessage).toHaveBeenCalledWith('Line 1\nLine 2');
  });

  it('handles custom placeholder text', () => {
    const customPlaceholder = 'Ask about your contract terms...';
    renderWithTheme(<ChatInterface placeholder={customPlaceholder} />);

    expect(screen.getByPlaceholderText(customPlaceholder)).toBeInTheDocument();
  });

  it('handles loading state prop', () => {
    renderWithTheme(<ChatInterface isLoading={true} />);

    const input = screen.getByPlaceholderText('Ask a question about your document...');
    const sendButton = screen.getByRole('button');

    expect(input).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  it('scrolls to bottom when new messages are added', async () => {
    const scrollIntoViewMock = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const { rerender } = renderWithTheme(<ChatInterface initialMessages={[]} />);

    // Add a message
    const newMessage: ChatMessage = {
      id: '1',
      content: 'New message',
      sender: 'user',
      timestamp: new Date(),
    };

    rerender(
      <ThemeProvider theme={theme}>
        <ChatInterface initialMessages={[newMessage]} />
      </ThemeProvider>
    );

    // Should scroll to bottom when messages change
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
  });
});