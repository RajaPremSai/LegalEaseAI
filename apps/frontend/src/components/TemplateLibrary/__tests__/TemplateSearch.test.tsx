import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TemplateSearch from '../TemplateSearch';
import { DocumentTemplate } from '@legal-ai/shared';

// Mock fetch
global.fetch = jest.fn();

const mockTemplates: DocumentTemplate[] = [
  {
    id: '1',
    name: 'Service Agreement',
    description: 'Standard service agreement template',
    category: 'contract',
    industry: ['Technology'],
    jurisdiction: ['US'],
    templateContent: 'Template content...',
    annotations: [],
    standardClauses: [],
    customizationOptions: [],
    version: '1.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    usage: { downloadCount: 10, rating: 4.5, reviewCount: 5 }
  }
];

const mockCategories = [
  { value: 'contract', label: 'Contracts', description: 'Business contracts' }
];

const mockIndustries = ['Technology', 'Healthcare', 'Finance'];

describe('TemplateSearch', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  const setupMocks = () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockCategories })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockIndustries })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: mockTemplates,
          pagination: { total: 1, limit: 12, offset: 0 }
        })
      });
  };

  it('renders search interface correctly', async () => {
    setupMocks();

    render(<TemplateSearch />);

    expect(screen.getByText('Search Templates')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search templates...')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Industry')).toBeInTheDocument();
    expect(screen.getByLabelText('Jurisdiction')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  it('loads and displays templates', async () => {
    setupMocks();

    render(<TemplateSearch />);

    await waitFor(() => {
      expect(screen.getByText('Service Agreement')).toBeInTheDocument();
    });

    expect(screen.getByText('Standard service agreement template')).toBeInTheDocument();
    expect(screen.getByText('contract')).toBeInTheDocument();
    expect(screen.getByText('Technology')).toBeInTheDocument();
    expect(screen.getByText('Downloaded 10 times')).toBeInTheDocument();
  });

  it('handles search functionality', async () => {
    setupMocks();

    const onTemplateSelect = jest.fn();
    render(<TemplateSearch onTemplateSelect={onTemplateSelect} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Service Agreement')).toBeInTheDocument();
    });

    // Test search input
    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'service' } });

    // Mock search response
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: true,
        data: mockTemplates,
        pagination: { total: 1, limit: 12, offset: 0 }
      })
    });

    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/templates/search?')
      );
    });
  });

  it('handles template actions', async () => {
    setupMocks();

    const onTemplateSelect = jest.fn();
    const onTemplateCompare = jest.fn();
    const onTemplateDownload = jest.fn();

    render(
      <TemplateSearch
        onTemplateSelect={onTemplateSelect}
        onTemplateCompare={onTemplateCompare}
        onTemplateDownload={onTemplateDownload}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Service Agreement')).toBeInTheDocument();
    });

    // Test view action
    const viewButton = screen.getByRole('button', { name: /view/i });
    fireEvent.click(viewButton);
    expect(onTemplateSelect).toHaveBeenCalledWith(mockTemplates[0]);

    // Test compare action
    const compareButton = screen.getByRole('button', { name: /compare/i });
    fireEvent.click(compareButton);
    expect(onTemplateCompare).toHaveBeenCalledWith('1');

    // Test download action
    const downloadButton = screen.getByRole('button', { name: /download/i });
    fireEvent.click(downloadButton);
    expect(onTemplateDownload).toHaveBeenCalledWith('1');
  });

  it('handles filter changes', async () => {
    setupMocks();

    render(<TemplateSearch />);

    await waitFor(() => {
      expect(screen.getByLabelText('Category')).toBeInTheDocument();
    });

    // Test category filter
    const categorySelect = screen.getByLabelText('Category');
    fireEvent.mouseDown(categorySelect);
    
    await waitFor(() => {
      const contractOption = screen.getByText('Contracts');
      fireEvent.click(contractOption);
    });

    // Mock filtered search response
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: true,
        data: mockTemplates,
        pagination: { total: 1, limit: 12, offset: 0 }
      })
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('category=contract')
      );
    });
  });

  it('displays error message on fetch failure', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockCategories })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockIndustries })
      })
      .mockRejectedValueOnce(new Error('Network error'));

    render(<TemplateSearch />);

    await waitFor(() => {
      expect(screen.getByText(/failed to search templates/i)).toBeInTheDocument();
    });
  });

  it('displays no results message when no templates found', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockCategories })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockIndustries })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: [],
          pagination: { total: 0, limit: 12, offset: 0 }
        })
      });

    render(<TemplateSearch />);

    await waitFor(() => {
      expect(screen.getByText('No templates found')).toBeInTheDocument();
    });

    expect(screen.getByText('Try adjusting your search criteria')).toBeInTheDocument();
  });

  it('handles pagination', async () => {
    const manyTemplates = Array.from({ length: 25 }, (_, i) => ({
      ...mockTemplates[0],
      id: `template-${i}`,
      name: `Template ${i}`
    }));

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockCategories })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: mockIndustries })
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: manyTemplates.slice(0, 12),
          pagination: { total: 25, limit: 12, offset: 0 }
        })
      });

    render(<TemplateSearch />);

    await waitFor(() => {
      expect(screen.getByText('Template 0')).toBeInTheDocument();
    });

    // Check if pagination is displayed
    const pagination = screen.getByRole('navigation');
    expect(pagination).toBeInTheDocument();
  });
});