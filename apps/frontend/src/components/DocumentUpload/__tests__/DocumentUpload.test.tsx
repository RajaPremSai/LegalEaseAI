import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../../theme';
import { DocumentUpload } from '../DocumentUpload';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('DocumentUpload', () => {
  const mockOnFileUpload = jest.fn();

  beforeEach(() => {
    mockOnFileUpload.mockClear();
  });

  it('renders upload interface correctly', () => {
    renderWithTheme(
      <DocumentUpload onFileUpload={mockOnFileUpload} />
    );

    expect(screen.getByText('Upload Legal Document')).toBeInTheDocument();
    expect(screen.getByText('Drag and drop your document here, or click to browse')).toBeInTheDocument();
    expect(screen.getByText('Supported formats: PDF, DOC, DOCX, TXT (Max 50MB)')).toBeInTheDocument();
    expect(screen.getByText('Choose File')).toBeInTheDocument();
  });

  it('shows uploading state correctly', () => {
    renderWithTheme(
      <DocumentUpload
        onFileUpload={mockOnFileUpload}
        isUploading={true}
        uploadProgress={50}
      />
    );

    expect(screen.getByText('Uploading document...')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays error message when provided', () => {
    const errorMessage = 'Upload failed. Please try again.';
    renderWithTheme(
      <DocumentUpload
        onFileUpload={mockOnFileUpload}
        error={errorMessage}
      />
    );

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('calls onFileUpload when file is dropped', async () => {
    const user = userEvent.setup();
    renderWithTheme(
      <DocumentUpload onFileUpload={mockOnFileUpload} />
    );

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, file);

    await waitFor(() => {
      expect(mockOnFileUpload).toHaveBeenCalledWith(file);
    });
  });

  it('disables upload when isUploading is true', () => {
    renderWithTheme(
      <DocumentUpload
        onFileUpload={mockOnFileUpload}
        isUploading={true}
      />
    );

    const button = screen.getByText('Choose File');
    expect(button).toBeDisabled();
  });

  it('shows drag active state', () => {
    renderWithTheme(
      <DocumentUpload onFileUpload={mockOnFileUpload} />
    );

    const dropzone = screen.getByText('Upload Legal Document').closest('[role="button"]');
    
    fireEvent.dragEnter(dropzone!);
    expect(screen.getByText('Drop your document here')).toBeInTheDocument();
  });
});