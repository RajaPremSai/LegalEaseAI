import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Tabs,
  Tab,
  Paper,
  Alert,
  Snackbar
} from '@mui/material';
import { DocumentTemplate, Document } from '@legal-ai/shared';
import TemplateSearch from './TemplateSearch';
import TemplateViewer from './TemplateViewer';
import TemplateCustomizer from './TemplateCustomizer';
import TemplateComparison from './TemplateComparison';

interface TemplateLibraryProps {
  userDocuments?: Document[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`template-tabpanel-${index}`}
      aria-labelledby={`template-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const TemplateLibrary: React.FC<TemplateLibraryProps> = ({ userDocuments = [] }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [comparisonTemplateId, setComparisonTemplateId] = useState<string>('');
  const [popularTemplates, setPopularTemplates] = useState<DocumentTemplate[]>([]);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  useEffect(() => {
    loadPopularTemplates();
  }, []);

  const loadPopularTemplates = async () => {
    try {
      const response = await fetch('/api/templates/popular?limit=6');
      const data = await response.json();
      if (data.success) {
        setPopularTemplates(data.data);
      }
    } catch (error) {
      console.error('Failed to load popular templates:', error);
    }
  };

  const handleTemplateSelect = async (template: DocumentTemplate) => {
    // If we only have basic template info, fetch full details
    if (!template.annotations || template.annotations.length === 0) {
      try {
        const response = await fetch(`/api/templates/${template.id}`);
        const data = await response.json();
        if (data.success) {
          setSelectedTemplate(data.data);
        } else {
          setSelectedTemplate(template);
        }
      } catch (error) {
        setSelectedTemplate(template);
      }
    } else {
      setSelectedTemplate(template);
    }
    setViewerOpen(true);
  };

  const handleTemplateCompare = (templateId: string) => {
    if (userDocuments.length === 0) {
      showNotification('Please upload a document first to compare with templates', 'warning');
      return;
    }
    setComparisonTemplateId(templateId);
    setComparisonOpen(true);
  };

  const handleTemplateDownload = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}/download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        const template = data.data;
        
        // Create and download the template file
        const blob = new Blob([template.templateContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_template.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('Template downloaded successfully', 'success');
      } else {
        showNotification(data.error || 'Failed to download template', 'error');
      }
    } catch (error) {
      showNotification('Failed to download template', 'error');
    }
  };

  const handleTemplateCustomize = (templateId: string) => {
    if (selectedTemplate && selectedTemplate.id === templateId) {
      setCustomizerOpen(true);
    } else {
      // Load template details first
      fetch(`/api/templates/${templateId}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setSelectedTemplate(data.data);
            setCustomizerOpen(true);
          } else {
            showNotification('Failed to load template for customization', 'error');
          }
        })
        .catch(() => {
          showNotification('Failed to load template for customization', 'error');
        });
    }
  };

  const handleCustomizedTemplateSave = (customizedContent: string) => {
    // Create and download the customized template
    const blob = new Blob([customizedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customized_${selectedTemplate?.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('Customized template saved successfully', 'success');
  };

  const showNotification = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Template Library
        </Typography>
        
        <Typography variant="h6" color="text.secondary" paragraph>
          Browse, customize, and compare legal document templates to ensure your agreements meet industry standards.
        </Typography>

        <Paper sx={{ width: '100%' }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            aria-label="template library tabs"
          >
            <Tab label="Browse Templates" />
            <Tab label="Popular Templates" />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            <TemplateSearch
              onTemplateSelect={handleTemplateSelect}
              onTemplateCompare={handleTemplateCompare}
              onTemplateDownload={handleTemplateDownload}
            />
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <Box>
              <Typography variant="h5" gutterBottom>
                Most Popular Templates
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                These templates are most frequently downloaded and highly rated by our users.
              </Typography>
              
              {popularTemplates.length > 0 ? (
                <TemplateSearch
                  onTemplateSelect={handleTemplateSelect}
                  onTemplateCompare={handleTemplateCompare}
                  onTemplateDownload={handleTemplateDownload}
                />
              ) : (
                <Alert severity="info">
                  Loading popular templates...
                </Alert>
              )}
            </Box>
          </TabPanel>
        </Paper>

        {/* Template Viewer Dialog */}
        {selectedTemplate && (
          <TemplateViewer
            template={selectedTemplate}
            open={viewerOpen}
            onClose={() => {
              setViewerOpen(false);
              setSelectedTemplate(null);
            }}
            onDownload={handleTemplateDownload}
            onCompare={handleTemplateCompare}
            onCustomize={handleTemplateCustomize}
          />
        )}

        {/* Template Customizer Dialog */}
        {selectedTemplate && (
          <TemplateCustomizer
            template={selectedTemplate}
            open={customizerOpen}
            onClose={() => setCustomizerOpen(false)}
            onSave={handleCustomizedTemplateSave}
          />
        )}

        {/* Template Comparison Dialog */}
        <TemplateComparison
          templateId={comparisonTemplateId}
          open={comparisonOpen}
          onClose={() => setComparisonOpen(false)}
          userDocuments={userDocuments}
        />

        {/* Notification Snackbar */}
        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={handleCloseNotification}
        >
          <Alert
            onClose={handleCloseNotification}
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};

export default TemplateLibrary;