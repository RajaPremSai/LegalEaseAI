import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  LinearProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  ExpandMore,
  CheckCircle,
  Warning,
  Error,
  Info,
  Compare,
  Close,
  Download
} from '@mui/icons-material';
import { TemplateComparison, Document } from '@legal-ai/shared';

interface TemplateComparisonProps {
  templateId: string;
  open: boolean;
  onClose: () => void;
  userDocuments?: Document[];
}

const TemplateComparisonComponent: React.FC<TemplateComparisonProps> = ({
  templateId,
  open,
  onClose,
  userDocuments = []
}) => {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [comparison, setComparison] = useState<TemplateComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userDocuments.length > 0 && !selectedDocumentId) {
      setSelectedDocumentId(userDocuments[0].id);
    }
  }, [userDocuments, selectedDocumentId]);

  const handleCompare = async () => {
    if (!selectedDocumentId) {
      setError('Please select a document to compare');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/templates/${templateId}/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          documentId: selectedDocumentId
        })
      });

      const data = await response.json();
      if (data.success) {
        setComparison(data.data);
      } else {
        setError(data.error || 'Failed to compare documents');
      }
    } catch (error) {
      setError('Failed to compare documents');
      console.error('Comparison error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getComplianceColor = (compliance: number) => {
    if (compliance >= 80) return 'success';
    if (compliance >= 60) return 'warning';
    return 'error';
  };

  const getComplianceText = (compliance: number) => {
    if (compliance >= 80) return 'High Compliance';
    if (compliance >= 60) return 'Moderate Compliance';
    return 'Low Compliance';
  };

  const getSeverityIcon = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high':
        return <Error color="error" />;
      case 'medium':
        return <Warning color="warning" />;
      case 'low':
        return <Info color="info" />;
    }
  };

  const getImportanceIcon = (importance: 'critical' | 'recommended' | 'optional') => {
    switch (importance) {
      case 'critical':
        return <Error color="error" />;
      case 'recommended':
        return <Warning color="warning" />;
      case 'optional':
        return <Info color="info" />;
    }
  };

  const downloadReport = () => {
    if (!comparison) return;

    const reportContent = `
TEMPLATE COMPARISON REPORT
Generated: ${new Date().toLocaleDateString()}

OVERALL COMPLIANCE: ${comparison.comparisonResult.overallCompliance}%
Status: ${getComplianceText(comparison.comparisonResult.overallCompliance)}

RISK ASSESSMENT:
${comparison.comparisonResult.riskAssessment.increasedrisk ? 'INCREASED RISK DETECTED' : 'NO SIGNIFICANT RISK INCREASE'}

Risk Factors:
${comparison.comparisonResult.riskAssessment.riskFactors.map(factor => `- ${factor}`).join('\n')}

MISSING CLAUSES (${comparison.comparisonResult.missingClauses.length}):
${comparison.comparisonResult.missingClauses.map(clause => 
  `- ${clause.title} (${clause.importance}): ${clause.description}`
).join('\n')}

DEVIATIONS (${comparison.comparisonResult.deviations.length}):
${comparison.comparisonResult.deviations.map(deviation => 
  `- ${deviation.deviationType} (${deviation.severity}): ${deviation.explanation}`
).join('\n')}

RECOMMENDATIONS:
${comparison.comparisonResult.recommendations.map(rec => `- ${rec}`).join('\n')}
    `;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-comparison-report-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          <Typography variant="h5">Template Comparison</Typography>
          <Button onClick={onClose} startIcon={<Close />}>
            Close
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Document Selection */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Select Document to Compare
          </Typography>
          
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <FormControl fullWidth>
                <InputLabel>Your Document</InputLabel>
                <Select
                  value={selectedDocumentId}
                  label="Your Document"
                  onChange={(e) => setSelectedDocumentId(e.target.value)}
                >
                  {userDocuments.map((doc) => (
                    <MenuItem key={doc.id} value={doc.id}>
                      {doc.filename} ({doc.documentType})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Compare />}
                onClick={handleCompare}
                disabled={loading || !selectedDocumentId}
              >
                {loading ? <CircularProgress size={20} /> : 'Compare'}
              </Button>
            </Grid>
          </Grid>

          {userDocuments.length === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              No documents available for comparison. Please upload a document first.
            </Alert>
          )}
        </Paper>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Comparison Results */}
        {comparison && (
          <Box>
            {/* Overall Compliance */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Overall Compliance
              </Typography>
              
              <Box display="flex" alignItems="center" sx={{ mb: 2 }}>
                <Box sx={{ width: '100%', mr: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={comparison.comparisonResult.overallCompliance}
                    color={getComplianceColor(comparison.comparisonResult.overallCompliance) as any}
                    sx={{ height: 10, borderRadius: 5 }}
                  />
                </Box>
                <Typography variant="h6" sx={{ minWidth: 50 }}>
                  {comparison.comparisonResult.overallCompliance}%
                </Typography>
              </Box>
              
              <Chip
                label={getComplianceText(comparison.comparisonResult.overallCompliance)}
                color={getComplianceColor(comparison.comparisonResult.overallCompliance) as any}
              />
            </Paper>

            {/* Risk Assessment */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Risk Assessment
              </Typography>
              
              <Alert 
                severity={comparison.comparisonResult.riskAssessment.increasedrisk ? 'warning' : 'success'}
                sx={{ mb: 2 }}
              >
                {comparison.comparisonResult.riskAssessment.increasedrisk 
                  ? 'Increased risk detected in your document'
                  : 'No significant risk increase detected'
                }
              </Alert>

              {comparison.comparisonResult.riskAssessment.riskFactors.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Risk Factors:
                  </Typography>
                  <List dense>
                    {comparison.comparisonResult.riskAssessment.riskFactors.map((factor, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Warning color="warning" />
                        </ListItemIcon>
                        <ListItemText primary={factor} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Paper>

            {/* Missing Clauses */}
            {comparison.comparisonResult.missingClauses.length > 0 && (
              <Accordion sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6">
                    Missing Clauses ({comparison.comparisonResult.missingClauses.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List>
                    {comparison.comparisonResult.missingClauses.map((clause, index) => (
                      <ListItem key={index} divider>
                        <ListItemIcon>
                          {getImportanceIcon(clause.importance)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center">
                              <Typography variant="subtitle1">{clause.title}</Typography>
                              <Chip
                                label={clause.importance}
                                size="small"
                                color={clause.importance === 'critical' ? 'error' : 
                                       clause.importance === 'recommended' ? 'warning' : 'default'}
                                sx={{ ml: 1 }}
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" paragraph>
                                {clause.description}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Suggested content: {clause.suggestedContent.substring(0, 100)}...
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

            {/* Deviations */}
            {comparison.comparisonResult.deviations.length > 0 && (
              <Accordion sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6">
                    Deviations ({comparison.comparisonResult.deviations.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List>
                    {comparison.comparisonResult.deviations.map((deviation, index) => (
                      <ListItem key={index} divider>
                        <ListItemIcon>
                          {getSeverityIcon(deviation.severity)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center">
                              <Typography variant="subtitle1">
                                {deviation.deviationType.charAt(0).toUpperCase() + deviation.deviationType.slice(1)} Clause
                              </Typography>
                              <Chip
                                label={deviation.severity}
                                size="small"
                                color={deviation.severity === 'high' ? 'error' : 
                                       deviation.severity === 'medium' ? 'warning' : 'info'}
                                sx={{ ml: 1 }}
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" paragraph>
                                {deviation.explanation}
                              </Typography>
                              <Typography variant="body2" color="primary">
                                Recommendation: {deviation.recommendation}
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

            {/* Recommendations */}
            {comparison.comparisonResult.recommendations.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6">
                    Recommendations ({comparison.comparisonResult.recommendations.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List>
                    {comparison.comparisonResult.recommendations.map((recommendation, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <CheckCircle color="success" />
                        </ListItemIcon>
                        <ListItemText primary={recommendation} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {comparison && (
          <Button
            onClick={downloadReport}
            startIcon={<Download />}
          >
            Download Report
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TemplateComparisonComponent;