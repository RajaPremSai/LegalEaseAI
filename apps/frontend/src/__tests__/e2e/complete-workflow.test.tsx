/**
 * End-to-End Test Suite: Complete User Workflows
 * Tests the entire user journey from document upload to analysis
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ThemeProvider } from '@mui/material/styles';
import React from 'react';

// Mock components for testing
const MockApp: React.FC = () => {
  return (
    <div role="main">
      <h1>Legal Document AI Assistant</h1>
      <div data-testid="upload-area">
        <input type="file" aria-label="Upload document" />
        <button type="button" aria-label="Camera">Camera</button>
      </div>
      <div data-testid="mobile-analysis-view" style={{ display: 'none' }}>
        Mobile Analysis View
      </div>
      <div role="status" aria-live="polite">Status updates</div>
      <select aria-label="Language">
        <option value="en">English</option>
        <option value="fr">Français</option>
      </select>
      <button type="button">Upload Document</button>
      <button type="button">View Risks</button>
      <button type="button">Download Report</button>
      <input type="text" placeholder="Ask a question about your document" />
      <button type="button">Ask</button>
    </div>
  );
};

// Mock API responses
const mockDocumentAnalysis = {
  id: 'test-doc-123',
  summary: 'This is a rental agreement with standard terms and conditions.',
  riskScore: 'medium' as const,
  keyTerms: [
    {
      term: 'Security Deposit',
      definition: 'Money held by landlord as protection against damages',
      importance: 'high' as const,
      location: { page: 1, line: 15 }
    }
  ],
  risks: [
    {
      category: 'financial' as const,
      severity: 'medium' as const,
      description: 'High security deposit requirement',
      affectedClause: 'Section 3.2',
      recommendation: 'Consider negotiating a lower security deposit'
    }
  ],
  recommendations: [
    'Review the termination clause carefully',
    'Ensure you understand the maintenance responsibilities'
  ],
  clauses: [
    {
      id: 'clause-1',
      title: 'Rent Payment',
      content: 'Rent is due on the first of each month',
      riskLevel: 'low' as const,
      explanation: 'Standard rent payment terms'
    }
  ],
  generatedAt: new Date()
};

// Mock file for testing
const createMockFile = (name: string, type: string, size: number) => {
  const file = new File(['mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Mock fetch globally
global.fetch = jest.fn();

describe('Complete User Workflows E2E Tests', () => {
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
    
    // Mock successful authentication
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: { id: 'user-123', email: 'test@example.com' } })
    } as Response);
  });

  afterEach(() => {
    mockFetch.mockClear();
  });

  test('Complete workflow: Upload document → Analysis → Q&A → Risk Assessment', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MockApp />
      </TestWrapper>
    );

    // Step 1: User uploads a document
    const fileInput = screen.getByLabelText(/upload document/i);
    const testFile = createMockFile('rental-agreement.pdf', 'application/pdf', 1024 * 1024);

    // Mock upload response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ documentId: 'test-doc-123', status: 'processing' })
    });

    await user.upload(fileInput, testFile);

    // Verify upload initiated
    expect(screen.getByText(/uploading/i)).toBeInTheDocument();

    // Step 2: Document processing completes
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockDocumentAnalysis, status: 'analyzed' })
    });

    // Wait for analysis to complete
    await waitFor(() => {
      expect(screen.getByText(/analysis complete/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Step 3: Verify analysis results are displayed
    expect(screen.getByText(mockDocumentAnalysis.summary)).toBeInTheDocument();
    expect(screen.getByText(/risk score: medium/i)).toBeInTheDocument();
    expect(screen.getByText('Security Deposit')).toBeInTheDocument();

    // Step 4: User asks a question
    const questionInput = screen.getByPlaceholderText(/ask a question/i);
    const questionText = 'What happens if I break the lease early?';
    
    await user.type(questionInput, questionText);
    
    const askButton = screen.getByRole('button', { name: /ask/i });
    
    // Mock Q&A response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        answer: 'According to Section 5.3, early termination requires 30 days notice and forfeiture of security deposit.',
        sources: ['Section 5.3'],
        confidence: 0.95
      })
    });

    await user.click(askButton);

    // Verify Q&A response
    await waitFor(() => {
      expect(screen.getByText(/according to section 5.3/i)).toBeInTheDocument();
    });

    // Step 5: User views detailed risk assessment
    const riskButton = screen.getByRole('button', { name: /view risks/i });
    await user.click(riskButton);

    // Verify risk details are shown
    expect(screen.getByText('High security deposit requirement')).toBeInTheDocument();
    expect(screen.getByText('Consider negotiating a lower security deposit')).toBeInTheDocument();

    // Step 6: User downloads analysis report
    const downloadButton = screen.getByRole('button', { name: /download report/i });
    
    // Mock download response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['PDF content'], { type: 'application/pdf' })
    });

    await user.click(downloadButton);

    // Verify download was initiated
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/documents/test-doc-123/report'),
        expect.any(Object)
      );
    });
  });

  test('Mobile workflow: Camera capture → Analysis → Mobile-optimized UI', async () => {
    // Mock mobile environment
    Object.defineProperty(window, 'innerWidth', { value: 375 });
    Object.defineProperty(window, 'innerHeight', { value: 667 });
    
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MockApp />
      </TestWrapper>
    );

    // Verify mobile UI elements
    expect(screen.getByRole('button', { name: /camera/i })).toBeInTheDocument();

    // Mock camera capture
    const cameraButton = screen.getByRole('button', { name: /camera/i });
    
    // Mock getUserMedia for camera access
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: jest.fn().mockResolvedValue({
          getTracks: () => [{ stop: jest.fn() }]
        })
      }
    });

    await user.click(cameraButton);

    // Verify camera interface opens
    await waitFor(() => {
      expect(screen.getByText(/position document/i)).toBeInTheDocument();
    });

    // Mock capture and upload
    const captureButton = screen.getByRole('button', { name: /capture/i });
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ documentId: 'mobile-doc-123', status: 'processing' })
    });

    await user.click(captureButton);

    // Verify mobile-optimized analysis view
    await waitFor(() => {
      expect(screen.getByTestId('mobile-analysis-view')).toBeInTheDocument();
    });
  });

  test('Error handling workflow: Upload failure → Retry → Success', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MockApp />
      </TestWrapper>
    );

    const fileInput = screen.getByLabelText(/upload document/i);
    const testFile = createMockFile('large-document.pdf', 'application/pdf', 60 * 1024 * 1024); // 60MB

    // Mock upload failure (file too large)
    mockFetch.mockRejectedValueOnce(new Error('File too large'));

    await user.upload(fileInput, testFile);

    // Verify error message
    await waitFor(() => {
      expect(screen.getByText(/file too large/i)).toBeInTheDocument();
    });

    // User tries with smaller file
    const smallerFile = createMockFile('contract.pdf', 'application/pdf', 5 * 1024 * 1024); // 5MB

    // Mock successful upload
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ documentId: 'retry-doc-123', status: 'processing' })
    });

    await user.upload(fileInput, smallerFile);

    // Verify success
    await waitFor(() => {
      expect(screen.getByText(/uploading/i)).toBeInTheDocument();
    });
  });

  test('Accessibility workflow: Screen reader navigation → Keyboard interaction', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MockApp />
      </TestWrapper>
    );

    // Test keyboard navigation
    const uploadButton = screen.getByRole('button', { name: /upload document/i });
    
    // Navigate using Tab key
    await user.tab();
    expect(uploadButton).toHaveFocus();

    // Test ARIA labels and descriptions
    expect(uploadButton).toHaveAttribute('aria-describedby');
    
    // Test high contrast mode compatibility
    document.body.classList.add('high-contrast');
    
    // Verify elements are still visible and accessible
    expect(uploadButton).toBeVisible();
    
    // Test screen reader announcements
    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });

  test('Multi-language workflow: Switch language → Upload → Analysis in different language', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <MockApp />
      </TestWrapper>
    );

    // Switch to French
    const languageSelector = screen.getByRole('combobox', { name: /language/i });
    await user.selectOptions(languageSelector, 'fr');

    // Verify UI switched to French
    await waitFor(() => {
      expect(screen.getByText(/télécharger un document/i)).toBeInTheDocument();
    });

    // Upload document
    const fileInput = screen.getByLabelText(/télécharger un document/i);
    const testFile = createMockFile('contrat.pdf', 'application/pdf', 1024 * 1024);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        documentId: 'fr-doc-123', 
        status: 'analyzed',
        summary: 'Ceci est un contrat de location avec des termes standards.',
        language: 'fr'
      })
    });

    await user.upload(fileInput, testFile);

    // Verify analysis in French
    await waitFor(() => {
      expect(screen.getByText(/ceci est un contrat de location/i)).toBeInTheDocument();
    });
  });
});