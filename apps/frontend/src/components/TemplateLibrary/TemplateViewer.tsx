import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Rating,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import {
  ExpandMore,
  Info,
  Warning,
  Settings,
  Alternative,
  Download,
  Compare,
  Close
} from '@mui/icons-material';
import { DocumentTemplate, TemplateAnnotation } from '@legal-ai/shared';

interface TemplateViewerProps {
  template: DocumentTemplate;
  open: boolean;
  onClose: () => void;
  onDownload?: (templateId: string) => void;
  onCompare?: (templateId: string) => void;
  onCustomize?: (templateId: string) => void;
}

const TemplateViewer: React.FC<TemplateViewerProps> = ({
  template,
  open,
  onClose,
  onDownload,
  onCompare,
  onCustomize
}) => {
  const [selectedAnnotation, setSelectedAnnotation] = useState<TemplateAnnotation | null>(null);

  const getAnnotationIcon = (type: TemplateAnnotation['type']) => {
    switch (type) {
      case 'explanation':
        return <Info color="info" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'customization':
        return <Settings color="primary" />;
      case 'alternative':
        return <Alternative color="secondary" />;
      default:
        return <Info />;
    }
  };

  const getAnnotationColor = (importance: TemplateAnnotation['importance']) => {
    switch (importance) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const highlightAnnotations = (content: string, annotations: TemplateAnnotation[]) => {
    if (!annotations.length) return content;

    // Sort annotations by start index to process them in order
    const sortedAnnotations = [...annotations].sort((a, b) => a.location.startIndex - b.location.startIndex);
    
    let highlightedContent = content;
    let offset = 0;

    sortedAnnotations.forEach((annotation, index) => {
      const start = annotation.location.startIndex + offset;
      const end = annotation.location.endIndex + offset;
      
      const beforeText = highlightedContent.substring(0, start);
      const annotatedText = highlightedContent.substring(start, end);
      const afterText = highlightedContent.substring(end);
      
      const highlightSpan = `<span 
        class="annotation-highlight annotation-${annotation.type}" 
        data-annotation-id="${annotation.id}"
        style="background-color: ${getHighlightColor(annotation.type)}; cursor: pointer; padding: 2px 4px; border-radius: 3px;"
        title="${annotation.title}"
      >${annotatedText}</span>`;
      
      highlightedContent = beforeText + highlightSpan + afterText;
      offset += highlightSpan.length - annotatedText.length;
    });

    return highlightedContent;
  };

  const getHighlightColor = (type: TemplateAnnotation['type']) => {
    switch (type) {
      case 'explanation':
        return '#e3f2fd';
      case 'warning':
        return '#fff3e0';
      case 'customization':
        return '#f3e5f5';
      case 'alternative':
        return '#e8f5e8';
      default:
        return '#f5f5f5';
    }
  };

  const handleAnnotationClick = (annotationId: string) => {
    const annotation = template.annotations.find(a => a.id === annotationId);
    if (annotation) {
      setSelectedAnnotation(annotation);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">{template.name}</Typography>
          <Button onClick={onClose} startIcon={<Close />}>
            Close
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Template Info */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="body1" paragraph>
                {template.description}
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Chip label={template.category} color="primary" sx={{ mr: 1 }} />
                <Chip label={`Version ${template.version}`} variant="outlined" sx={{ mr: 1 }} />
                {template.industry.map((industry) => (
                  <Chip key={industry} label={industry} variant="outlined" size="small" sx={{ mr: 1 }} />
                ))}
              </Box>
              
              <Box display="flex" alignItems="center" sx={{ mb: 1 }}>
                <Rating value={template.usage.rating} readOnly precision={0.1} />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  {template.usage.rating} ({template.usage.reviewCount} reviews)
                </Typography>
              </Box>
              
              <Typography variant="body2" color="text.secondary">
                Downloaded {template.usage.downloadCount} times
              </Typography>
            </Paper>
          </Grid>

          {/* Template Content */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2, height: '60vh', overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                Template Content
              </Typography>
              <Box
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  '& .annotation-highlight:hover': {
                    opacity: 0.8
                  }
                }}
                dangerouslySetInnerHTML={{
                  __html: highlightAnnotations(template.templateContent, template.annotations)
                }}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  const annotationId = target.getAttribute('data-annotation-id');
                  if (annotationId) {
                    handleAnnotationClick(annotationId);
                  }
                }}
              />
            </Paper>
          </Grid>

          {/* Annotations and Clauses */}
          <Grid item xs={12} md={4}>
            <Box sx={{ height: '60vh', overflow: 'auto' }}>
              {/* Annotations */}
              {template.annotations.length > 0 && (
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6">Annotations ({template.annotations.length})</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      {template.annotations.map((annotation) => (
                        <ListItem
                          key={annotation.id}
                          button
                          onClick={() => setSelectedAnnotation(annotation)}
                        >
                          <ListItemIcon>
                            {getAnnotationIcon(annotation.type)}
                          </ListItemIcon>
                          <ListItemText
                            primary={annotation.title}
                            secondary={
                              <Chip
                                label={annotation.importance}
                                size="small"
                                color={getAnnotationColor(annotation.importance) as any}
                              />
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Standard Clauses */}
              {template.standardClauses.length > 0 && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6">Standard Clauses ({template.standardClauses.length})</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      {template.standardClauses.map((clause) => (
                        <ListItem key={clause.id}>
                          <ListItemText
                            primary={clause.title}
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block">
                                  {clause.category} • {clause.riskLevel} risk
                                </Typography>
                                {clause.isRequired && (
                                  <Chip label="Required" size="small" color="error" />
                                )}
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Customization Options */}
              {template.customizationOptions.length > 0 && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6">Customizable Fields ({template.customizationOptions.length})</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      {template.customizationOptions.map((option) => (
                        <ListItem key={option.id}>
                          <ListItemText
                            primary={option.label}
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block">
                                  {option.fieldType} • {option.required ? 'Required' : 'Optional'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {option.description}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              )}
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={() => onCompare?.(template.id)} startIcon={<Compare />}>
          Compare with Document
        </Button>
        <Button onClick={() => onCustomize?.(template.id)} startIcon={<Settings />}>
          Customize Template
        </Button>
        <Button
          onClick={() => onDownload?.(template.id)}
          variant="contained"
          startIcon={<Download />}
        >
          Download Template
        </Button>
      </DialogActions>

      {/* Annotation Detail Dialog */}
      <Dialog
        open={!!selectedAnnotation}
        onClose={() => setSelectedAnnotation(null)}
        maxWidth="sm"
        fullWidth
      >
        {selectedAnnotation && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center">
                {getAnnotationIcon(selectedAnnotation.type)}
                <Typography variant="h6" sx={{ ml: 1 }}>
                  {selectedAnnotation.title}
                </Typography>
                <Chip
                  label={selectedAnnotation.importance}
                  size="small"
                  color={getAnnotationColor(selectedAnnotation.importance) as any}
                  sx={{ ml: 2 }}
                />
              </Box>
            </DialogTitle>
            <DialogContent>
              <Typography variant="body1">
                {selectedAnnotation.content}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedAnnotation(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Dialog>
  );
};

export default TemplateViewer;