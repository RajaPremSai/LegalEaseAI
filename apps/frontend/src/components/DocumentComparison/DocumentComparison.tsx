'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  useMediaQuery,
  Divider,
  Alert,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CompareArrows as CompareIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Remove as RemoveIcon,
  Add as AddIcon,
} from '@mui/icons-material';

export interface DocumentVersion {
  id: string;
  name: string;
  uploadedAt: Date;
  content: string;
  analysis?: {
    riskScore: 'low' | 'medium' | 'high';
    keyChanges?: string[];
  };
}

export interface DocumentChange {
  type: 'added' | 'removed' | 'modified';
  section: string;
  oldContent?: string;
  newContent?: string;
  impact: 'positive' | 'negative' | 'neutral';
  explanation: string;
  riskChange?: 'increased' | 'decreased' | 'unchanged';
}

interface DocumentComparisonProps {
  originalDocument: DocumentVersion;
  comparedDocument: DocumentVersion;
  changes?: DocumentChange[];
  onAnalyzeChanges?: () => void;
  isAnalyzing?: boolean;
}

export const DocumentComparison: React.FC<DocumentComparisonProps> = ({
  originalDocument,
  comparedDocument,
  changes = [],
  onAnalyzeChanges,
  isAnalyzing = false,
}) => {
  const [showOnlyChanges, setShowOnlyChanges] = useState(true);
  const [selectedChangeType, setSelectedChangeType] = useState<string>('all');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Use provided changes or mock changes if none provided
  const actualChanges: DocumentChange[] = useMemo(() => {
    if (changes !== undefined) return changes;
    
    return [
      {
        type: 'modified',
        section: 'Security Deposit',
        oldContent: 'Tenant shall pay a security deposit of $5,000 upon signing this agreement.',
        newContent: 'Tenant shall pay a security deposit of $3,000 upon signing this agreement.',
        impact: 'positive',
        explanation: 'Security deposit reduced by $2,000, making it more reasonable and closer to legal limits.',
        riskChange: 'decreased',
      },
      {
        type: 'added',
        section: 'Early Termination Clause',
        newContent: 'Tenant may terminate this lease early with 60 days written notice and payment of one month\'s rent as penalty.',
        impact: 'positive',
        explanation: 'New clause provides flexibility for early termination, which protects tenant interests.',
        riskChange: 'decreased',
      },
      {
        type: 'modified',
        section: 'Maintenance Responsibilities',
        oldContent: 'Tenant is responsible for all maintenance and repairs to the property.',
        newContent: 'Tenant is responsible for minor maintenance and repairs under $200. Landlord responsible for major repairs and structural issues.',
        impact: 'positive',
        explanation: 'Maintenance responsibilities clarified and limited, reducing tenant financial burden.',
        riskChange: 'decreased',
      },
      {
        type: 'removed',
        section: 'Automatic Renewal',
        oldContent: 'This lease automatically renews for additional one-year terms unless terminated.',
        impact: 'neutral',
        explanation: 'Automatic renewal clause removed, giving both parties more control over lease continuation.',
        riskChange: 'unchanged',
      },
    ];
  }, [changes]);

  const filteredChanges = useMemo(() => {
    if (selectedChangeType === 'all') return actualChanges;
    return actualChanges.filter(change => change.type === selectedChangeType);
  }, [actualChanges, selectedChangeType]);

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'added':
        return <AddIcon sx={{ color: 'success.main' }} />;
      case 'removed':
        return <RemoveIcon sx={{ color: 'error.main' }} />;
      case 'modified':
        return <CompareIcon sx={{ color: 'warning.main' }} />;
      default:
        return <CompareIcon />;
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive':
        return <TrendingUpIcon sx={{ color: 'success.main', fontSize: 16 }} />;
      case 'negative':
        return <TrendingDownIcon sx={{ color: 'error.main', fontSize: 16 }} />;
      default:
        return null;
    }
  };

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'added':
        return 'success';
      case 'removed':
        return 'error';
      case 'modified':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getRiskChangeColor = (riskChange?: string) => {
    switch (riskChange) {
      case 'decreased':
        return 'success';
      case 'increased':
        return 'error';
      default:
        return 'default';
    }
  };

  const overallImpact = useMemo(() => {
    const positiveChanges = actualChanges.filter(c => c.impact === 'positive').length;
    const negativeChanges = actualChanges.filter(c => c.impact === 'negative').length;
    
    if (positiveChanges > negativeChanges) return 'positive';
    if (negativeChanges > positiveChanges) return 'negative';
    return 'neutral';
  }, [actualChanges]);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: isMobile ? 1 : 2 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
          Document Comparison
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Comparing changes between document versions
        </Typography>
      </Box>

      {/* Document Info Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Original Document
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {originalDocument.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Uploaded: {originalDocument.uploadedAt.toLocaleDateString()}
              </Typography>
              {originalDocument.analysis && (
                <Box sx={{ mt: 1 }}>
                  <Chip
                    label={`${originalDocument.analysis.riskScore} risk`}
                    size="small"
                    color={originalDocument.analysis.riskScore === 'high' ? 'error' : 
                           originalDocument.analysis.riskScore === 'medium' ? 'warning' : 'success'}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Updated Document
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {comparedDocument.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Uploaded: {comparedDocument.uploadedAt.toLocaleDateString()}
              </Typography>
              {comparedDocument.analysis && (
                <Box sx={{ mt: 1 }}>
                  <Chip
                    label={`${comparedDocument.analysis.riskScore} risk`}
                    size="small"
                    color={comparedDocument.analysis.riskScore === 'high' ? 'error' : 
                           comparedDocument.analysis.riskScore === 'medium' ? 'warning' : 'success'}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Overall Impact Summary */}
      <Alert
        severity={overallImpact === 'positive' ? 'success' : overallImpact === 'negative' ? 'error' : 'info'}
        sx={{ mb: 3 }}
        icon={getImpactIcon(overallImpact)}
      >
        <Typography variant="subtitle2">
          Overall Impact: {overallImpact === 'positive' ? 'Favorable Changes' : 
                          overallImpact === 'negative' ? 'Unfavorable Changes' : 'Mixed Changes'}
        </Typography>
        <Typography variant="body2">
          {actualChanges.length} changes detected. 
          {actualChanges.filter(c => c.impact === 'positive').length} positive, 
          {actualChanges.filter(c => c.impact === 'negative').length} negative, 
          {actualChanges.filter(c => c.impact === 'neutral').length} neutral.
        </Typography>
      </Alert>

      {/* Controls */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControlLabel
          control={
            <Switch
              checked={showOnlyChanges}
              onChange={(e) => setShowOnlyChanges(e.target.checked)}
            />
          }
          label="Show only changes"
        />
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {['all', 'added', 'removed', 'modified'].map((type) => (
            <Button
              key={type}
              variant={selectedChangeType === type ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setSelectedChangeType(type)}
              sx={{ textTransform: 'capitalize' }}
            >
              {type === 'all' ? 'All Changes' : `${type} (${actualChanges.filter(c => c.type === type).length})`}
            </Button>
          ))}
        </Box>

        {onAnalyzeChanges && (
          <Button
            variant="contained"
            onClick={onAnalyzeChanges}
            disabled={isAnalyzing}
            startIcon={isAnalyzing ? undefined : <CompareIcon />}
          >
            {isAnalyzing ? 'Analyzing...' : 'Re-analyze Changes'}
          </Button>
        )}
      </Box>

      {/* Changes List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Detected Changes ({filteredChanges.length})
          </Typography>
          
          {filteredChanges.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No changes found for the selected filter.
            </Typography>
          ) : (
            filteredChanges.map((change, index) => (
              <Accordion key={index} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    {getChangeIcon(change.type)}
                    <Typography variant="subtitle1" sx={{ fontWeight: 500, flex: 1 }}>
                      {change.section}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip
                        label={change.type}
                        size="small"
                        color={getChangeTypeColor(change.type) as any}
                        variant="outlined"
                      />
                      {change.riskChange && change.riskChange !== 'unchanged' && (
                        <Chip
                          label={`Risk ${change.riskChange}`}
                          size="small"
                          color={getRiskChangeColor(change.riskChange) as any}
                          variant="filled"
                        />
                      )}
                      {getImpactIcon(change.impact)}
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Old Content */}
                    {change.oldContent && (
                      <Box>
                        <Typography variant="subtitle2" color="error.main" gutterBottom>
                          Original:
                        </Typography>
                        <Box
                          sx={{
                            p: 2,
                            bgcolor: 'error.50',
                            borderLeft: 3,
                            borderColor: 'error.main',
                            borderRadius: 1,
                          }}
                        >
                          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                            {change.oldContent}
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {/* New Content */}
                    {change.newContent && (
                      <Box>
                        <Typography variant="subtitle2" color="success.main" gutterBottom>
                          {change.type === 'added' ? 'Added:' : 'Updated:'}
                        </Typography>
                        <Box
                          sx={{
                            p: 2,
                            bgcolor: 'success.50',
                            borderLeft: 3,
                            borderColor: 'success.main',
                            borderRadius: 1,
                          }}
                        >
                          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                            {change.newContent}
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    <Divider />

                    {/* Explanation */}
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Impact Analysis:
                      </Typography>
                      <Typography variant="body2">
                        {change.explanation}
                      </Typography>
                    </Box>
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))
          )}
        </CardContent>
      </Card>
    </Box>
  );
};