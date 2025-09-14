'use client';

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Grid,
  useTheme,
  useMediaQuery,
  Divider,
  Button,
  ButtonGroup,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Description as DescriptionIcon,
  Lightbulb as LightbulbIcon,
  Assignment as AssignmentIcon,
  CompareArrows as CompareIcon,
  GetApp as DownloadIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { RiskVisualization } from './RiskVisualization';
import type { Risk } from './RiskVisualization';

export interface KeyTerm {
  term: string;
  definition: string;
  importance: 'high' | 'medium' | 'low';
  location: string;
}

export interface Clause {
  id: string;
  title: string;
  content: string;
  riskLevel: 'high' | 'medium' | 'low';
  explanation: string;
}

export interface DocumentAnalysis {
  summary: string;
  riskScore: 'low' | 'medium' | 'high';
  keyTerms: KeyTerm[];
  risks: Risk[];
  recommendations: string[];
  clauses: Clause[];
  generatedAt: Date;
}

interface AnalysisDashboardProps {
  analysis: DocumentAnalysis;
  documentName: string;
  onCompareDocuments?: () => void;
  onDownloadReport?: () => void;
  onShareAnalysis?: () => void;
}

const getImportanceColor = (importance: string) => {
  switch (importance) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'success';
    default:
      return 'default';
  }
};

export const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
  analysis,
  documentName,
  onCompareDocuments,
  onDownloadReport,
  onShareAnalysis,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: isMobile ? 1 : 2 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
              Document Analysis
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {documentName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Analyzed on {analysis.generatedAt.toLocaleDateString()}
            </Typography>
          </Box>
          
          {!isMobile && (
            <ButtonGroup variant="outlined" size="small">
              {onCompareDocuments && (
                <Button startIcon={<CompareIcon />} onClick={onCompareDocuments}>
                  Compare Versions
                </Button>
              )}
              {onDownloadReport && (
                <Button startIcon={<DownloadIcon />} onClick={onDownloadReport}>
                  Download Report
                </Button>
              )}
              {onShareAnalysis && (
                <Button startIcon={<ShareIcon />} onClick={onShareAnalysis}>
                  Share
                </Button>
              )}
            </ButtonGroup>
          )}
        </Box>

        {/* Mobile Action Buttons */}
        {isMobile && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {onCompareDocuments && (
              <Button 
                variant="outlined" 
                size="small" 
                startIcon={<CompareIcon />} 
                onClick={onCompareDocuments}
              >
                Compare
              </Button>
            )}
            {onDownloadReport && (
              <Button 
                variant="outlined" 
                size="small" 
                startIcon={<DownloadIcon />} 
                onClick={onDownloadReport}
              >
                Download
              </Button>
            )}
            {onShareAnalysis && (
              <Button 
                variant="outlined" 
                size="small" 
                startIcon={<ShareIcon />} 
                onClick={onShareAnalysis}
              >
                Share
              </Button>
            )}
          </Box>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Left Column - Summary and Risk */}
        <Grid item xs={12} lg={8}>
          {/* Document Summary */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DescriptionIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Document Summary</Typography>
              </Box>
              <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
                {analysis.summary}
              </Typography>
            </CardContent>
          </Card>

          {/* Key Terms */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Key Terms & Definitions
              </Typography>
              
              {analysis.keyTerms.map((term, index) => (
                <Accordion key={index} sx={{ mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                        {term.term}
                      </Typography>
                      <Chip
                        label={term.importance}
                        size="small"
                        color={getImportanceColor(term.importance) as any}
                        variant="outlined"
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" gutterBottom>
                      {term.definition}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Found in: {term.location}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>

          {/* Document Clauses */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Document Clauses Analysis
              </Typography>
              
              {analysis.clauses.map((clause, index) => (
                <Accordion key={clause.id} sx={{ mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                        {clause.title}
                      </Typography>
                      <Chip
                        label={`${clause.riskLevel} risk`}
                        size="small"
                        color={getImportanceColor(clause.riskLevel) as any}
                        variant="filled"
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" gutterBottom sx={{ fontStyle: 'italic' }}>
                      "{clause.content}"
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body2">
                      <strong>Plain English:</strong> {clause.explanation}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Risk and Recommendations */}
        <Grid item xs={12} lg={4}>
          {/* Risk Visualization */}
          <RiskVisualization
            riskScore={analysis.riskScore}
            risks={analysis.risks}
          />

          {/* Recommendations */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <LightbulbIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">Recommendations</Typography>
              </Box>
              
              {analysis.recommendations.map((recommendation, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <AssignmentIcon
                      sx={{ fontSize: 16, mt: 0.5, color: 'primary.main' }}
                    />
                    <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                      {recommendation}
                    </Typography>
                  </Box>
                  {index < analysis.recommendations.length - 1 && (
                    <Divider sx={{ mt: 1 }} />
                  )}
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};