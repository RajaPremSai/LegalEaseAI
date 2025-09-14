import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Rating,
  Pagination,
  CircularProgress,
  Alert
} from '@mui/material';
import { Search, Download, Visibility, Compare } from '@mui/icons-material';
import { DocumentTemplate, TemplateSearch as TemplateSearchParams } from '@legal-ai/shared';

interface TemplateSearchProps {
  onTemplateSelect?: (template: DocumentTemplate) => void;
  onTemplateCompare?: (templateId: string) => void;
  onTemplateDownload?: (templateId: string) => void;
}

interface SearchFilters {
  query: string;
  category: string;
  industry: string;
  jurisdiction: string;
}

const TemplateSearch: React.FC<TemplateSearchProps> = ({
  onTemplateSelect,
  onTemplateCompare,
  onTemplateDownload
}) => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categories, setCategories] = useState<any[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    category: '',
    industry: '',
    jurisdiction: ''
  });

  const itemsPerPage = 12;

  useEffect(() => {
    loadCategories();
    loadIndustries();
    searchTemplates();
  }, [page, filters]);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/templates/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadIndustries = async () => {
    try {
      const response = await fetch('/api/templates/industries');
      const data = await response.json();
      if (data.success) {
        setIndustries(data.data);
      }
    } catch (error) {
      console.error('Failed to load industries:', error);
    }
  };

  const searchTemplates = async () => {
    setLoading(true);
    setError(null);

    try {
      const searchParams: TemplateSearchParams = {
        limit: itemsPerPage,
        offset: (page - 1) * itemsPerPage,
        ...(filters.query && { query: filters.query }),
        ...(filters.category && { category: filters.category as any }),
        ...(filters.industry && { industry: filters.industry }),
        ...(filters.jurisdiction && { jurisdiction: filters.jurisdiction })
      };

      const queryString = new URLSearchParams(
        Object.entries(searchParams).reduce((acc, [key, value]) => {
          if (value !== undefined && value !== '') {
            acc[key] = String(value);
          }
          return acc;
        }, {} as Record<string, string>)
      ).toString();

      const response = await fetch(`/api/templates/search?${queryString}`);
      const data = await response.json();

      if (data.success) {
        setTemplates(data.data);
        setTotalPages(Math.ceil(data.pagination.total / itemsPerPage));
      } else {
        setError(data.error || 'Failed to search templates');
      }
    } catch (error) {
      setError('Failed to search templates');
      console.error('Template search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: keyof SearchFilters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1); // Reset to first page when filters change
  };

  const handleSearch = () => {
    setPage(1);
    searchTemplates();
  };

  const handleTemplateAction = async (template: DocumentTemplate, action: 'view' | 'compare' | 'download') => {
    switch (action) {
      case 'view':
        onTemplateSelect?.(template);
        break;
      case 'compare':
        onTemplateCompare?.(template.id);
        break;
      case 'download':
        onTemplateDownload?.(template.id);
        break;
    }
  };

  return (
    <Box>
      {/* Search Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Search Templates
          </Typography>
          
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Search"
                placeholder="Search templates..."
                value={filters.query}
                onChange={(e) => handleFilterChange('query', e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </Grid>
            
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={filters.category}
                  label="Category"
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.value} value={category.value}>
                      {category.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Industry</InputLabel>
                <Select
                  value={filters.industry}
                  label="Industry"
                  onChange={(e) => handleFilterChange('industry', e.target.value)}
                >
                  <MenuItem value="">All Industries</MenuItem>
                  {industries.map((industry) => (
                    <MenuItem key={industry} value={industry}>
                      {industry}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Jurisdiction"
                placeholder="e.g., US, CA, UK"
                value={filters.jurisdiction}
                onChange={(e) => handleFilterChange('jurisdiction', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Search />}
                onClick={handleSearch}
                disabled={loading}
              >
                Search
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      )}

      {/* Template Results */}
      {!loading && (
        <>
          <Grid container spacing={2}>
            {templates.map((template) => (
              <Grid item xs={12} sm={6} md={4} key={template.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom noWrap>
                      {template.name}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {template.description}
                    </Typography>
                    
                    <Box sx={{ mb: 2 }}>
                      <Chip 
                        label={template.category} 
                        size="small" 
                        color="primary" 
                        sx={{ mr: 1, mb: 1 }}
                      />
                      {template.industry.slice(0, 2).map((industry) => (
                        <Chip 
                          key={industry}
                          label={industry} 
                          size="small" 
                          variant="outlined"
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                      {template.industry.length > 2 && (
                        <Chip 
                          label={`+${template.industry.length - 2} more`}
                          size="small" 
                          variant="outlined"
                          sx={{ mb: 1 }}
                        />
                      )}
                    </Box>
                    
                    <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
                      <Rating 
                        value={template.usage.rating} 
                        readOnly 
                        size="small" 
                        precision={0.1}
                      />
                      <Typography variant="caption" sx={{ ml: 1 }}>
                        ({template.usage.reviewCount} reviews)
                      </Typography>
                    </Box>
                    
                    <Typography variant="caption" color="text.secondary">
                      Downloaded {template.usage.downloadCount} times
                    </Typography>
                  </CardContent>
                  
                  <Box sx={{ p: 2, pt: 0 }}>
                    <Grid container spacing={1}>
                      <Grid item xs={4}>
                        <Button
                          fullWidth
                          size="small"
                          startIcon={<Visibility />}
                          onClick={() => handleTemplateAction(template, 'view')}
                        >
                          View
                        </Button>
                      </Grid>
                      <Grid item xs={4}>
                        <Button
                          fullWidth
                          size="small"
                          startIcon={<Compare />}
                          onClick={() => handleTemplateAction(template, 'compare')}
                        >
                          Compare
                        </Button>
                      </Grid>
                      <Grid item xs={4}>
                        <Button
                          fullWidth
                          size="small"
                          startIcon={<Download />}
                          onClick={() => handleTemplateAction(template, 'download')}
                        >
                          Download
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                color="primary"
              />
            </Box>
          )}

          {/* No Results */}
          {templates.length === 0 && !loading && (
            <Box textAlign="center" py={4}>
              <Typography variant="h6" color="text.secondary">
                No templates found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try adjusting your search criteria
              </Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default TemplateSearch;