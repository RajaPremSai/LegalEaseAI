import React from 'react';
import { render, screen } from '@testing-library/react';
import { DocumentUpload } from '../DocumentUpload';
import { axe, accessibilityTestUtils } from '../../../utils/accessibilityTesting';
import { AccessibilityProvider } from '../../../contexts/AccessibilityContext';

// Mock next-i18next
jest.mock('next-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'upload.title': 'Upload Legal Document',
        'upload.dragDrop': 'Drag and drop your document here, or click to browse',
        'upload.dropHere': 'Drop your document here',
        'upload.supportedFormats': 'Supported formats: PDF, DOC, DOCX, TXT (Max 50MB)',
        'upload.chooseFile': 'Choose File',
        'upload.or': 'OR',
        'upload.uploading': 'Uploading document...',
        'upload.uploadFailed': 'Upload failed. Please try again.',
      };
      return translations[key] || key;
    },
  }),
}));

const mockOnFileUpload = jest.fn();

const renderWithAccessibility = (props = {}) => {
  return render(
    <AccessibilityProvider>
      <DocumentUpload onFileUpload={mockOnFileUpload} {...props} />
    </AccessibilityProvider>
  );
};

describe('DocumentUpload Accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not have any accessibility violations', async () => {
    const { container } = renderWithAccessibility();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should have proper ARIA labels and descriptions', () => {
    const { container } = renderWithAccessibility();
    accessibilityTestUtils.testAriaLabels(container);
  });

  it('should have proper keyboard navigation', async () => {
    const { container } = renderWithAccessibility();
    await accessibilityTestUtils.testKeyboardNavigation(container);
  });

  it('should have proper focus management', () => {
    const { container } = renderWithAccessibility();
    accessibilityTestUtils.testFocusManagement(container);
  });

  it('should have proper semantic markup', () => {
    const { container } = renderWithAccessibility();
    accessibilityTestUtils.testSemanticMarkup(container);
  });

  it('should be screen reader compatible', () => {
    const { container } = renderWithAccessibility();
    accessibilityTestUtils.testScreenReaderCompatibility(container);
  });

  it('should have proper touch targets for mobile', () => {
    const { container } = renderWithAccessibility();
    accessibilityTestUtils.testMobileAccessibility(container);
  });

  it('should have accessible file input', () => {
    renderWithAccessibility();
    
    const fileInput = screen.getByRole('button', { name: /choose file/i });
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).not.toHaveAttribute('aria-hidden', 'true');
  });

  it('should have proper error announcements', () => {
    const errorMessage = 'File too large';
    renderWithAccessibility({ error: errorMessage });
    
    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent(errorMessage);
  });

  it('should have proper progress announcements', () => {
    renderWithAccessibility({ isUploading: true, uploadProgress: 50 });
    
    const progressText = screen.getByText('Uploading document...');
    expect(progressText).toBeInTheDocument();
    
    const progressValue = screen.getByText('50%');
    expect(progressValue).toBeInTheDocument();
  });

  it('should support high contrast mode', () => {
    const { container } = render(
      <AccessibilityProvider>
        <DocumentUpload onFileUpload={mockOnFileUpload} />
      </AccessibilityProvider>
    );

    // Test that elements have sufficient contrast
    accessibilityTestUtils.testColorContrast(container);
  });

  it('should have proper heading hierarchy', () => {
    const { container } = renderWithAccessibility();
    
    const heading = screen.getByRole('heading');
    expect(heading).toBeInTheDocument();
    expect(heading.tagName).toMatch(/^H[1-6]$/);
  });

  it('should have descriptive text for supported formats', () => {
    renderWithAccessibility();
    
    const formatText = screen.getByText(/supported formats/i);
    expect(formatText).toBeInTheDocument();
    expect(formatText).toBeVisible();
  });

  it('should handle drag and drop accessibility', () => {
    const { container } = renderWithAccessibility();
    
    const dropzone = container.querySelector('[role="button"]') || container.querySelector('input[type="file"]');
    expect(dropzone).toBeInTheDocument();
  });

  it('should provide clear instructions', () => {
    renderWithAccessibility();
    
    const instructions = screen.getByText(/drag and drop your document here/i);
    expect(instructions).toBeInTheDocument();
    expect(instructions).toBeVisible();
  });

  it('should have proper loading states', () => {
    renderWithAccessibility({ isUploading: true });
    
    const loadingText = screen.getByText(/uploading/i);
    expect(loadingText).toBeInTheDocument();
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });
});