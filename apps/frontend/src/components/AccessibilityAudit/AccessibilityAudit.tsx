'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import {
  BugReport as BugReportIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  Accessibility as AccessibilityIcon,
} from '@mui/icons-material';

interface AccessibilityIssue {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    target: string[];
    html: string;
    failureSummary: string;
  }>;
}

interface AccessibilityAuditProps {
  targetElement?: HTMLElement;
  onAuditComplete?: (results: any) => void;
}

export const AccessibilityAudit: React.FC<AccessibilityAuditProps> = ({
  targetElement,
  onAuditComplete,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runAudit = async () => {
    setIsRunning(true);
    setError(null);
    
    try {
      // Dynamic import of axe-core for client-side usage
      const axe = await import('axe-core');
      
      const element = targetElement || document.body;
      const auditResults = await axe.default.run(element, {
        rules: {
          'color-contrast': { enabled: true },
          'keyboard-navigation': { enabled: true },
          'focus-management': { enabled: true },
          'aria-labels': { enabled: true },
          'semantic-markup': { enabled: true },
        },
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
      });

      setResults(auditResults);
      onAuditComplete?.(auditResults);
    } catch (err) {
      setError('Failed to run accessibility audit');
      console.error('Accessibility audit error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical':
        return 'error';
      case 'serious':
        return 'error';
      case 'moderate':
        return 'warning';
      case 'minor':
        return 'info';
      default:
        return 'default';
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'critical':
      case 'serious':
        return <ErrorIcon color="error" />;
      case 'moderate':
        return <WarningIcon color="warning" />;
      case 'minor':
        return <BugReportIcon color="info" />;
      default:
        return <CheckCircleIcon color="success" />;
    }
  };

  const groupedViolations = results?.violations?.reduce((acc: any, violation: AccessibilityIssue) => {
    const impact = violation.impact;
    if (!acc[impact]) {
      acc[impact] = [];
    }
    acc[impact].push(violation);
    return acc;
  }, {}) || {};

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <AccessibilityIcon sx={{ mr: 2, fontSize: 28 }} />
          <Typography variant="h5" component="h2">
            Accessibility Audit
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            This tool runs automated accessibility tests based on WCAG 2.1 AA guidelines. 
            Note that automated testing can only catch about 30-40% of accessibility issues.
            Manual testing is still required for comprehensive accessibility validation.
          </Typography>
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            onClick={runAudit}
            disabled={isRunning}
            startIcon={isRunning ? <CircularProgress size={20} /> : <BugReportIcon />}
          >
            {isRunning ? 'Running Audit...' : 'Run Accessibility Audit'}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {results && (
          <Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <Chip
                icon={<CheckCircleIcon />}
                label={`${results.passes?.length || 0} Passed`}
                color="success"
                variant="outlined"
              />
              <Chip
                icon={<ErrorIcon />}
                label={`${results.violations?.length || 0} Violations`}
                color="error"
                variant="outlined"
              />
              <Chip
                icon={<WarningIcon />}
                label={`${results.incomplete?.length || 0} Incomplete`}
                color="warning"
                variant="outlined"
              />
            </Box>

            {results.violations?.length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Accessibility Violations
                </Typography>
                
                {Object.entries(groupedViolations).map(([impact, violations]: [string, any[]]) => (
                  <Accordion key={impact} defaultExpanded={impact === 'critical' || impact === 'serious'}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getImpactIcon(impact)}
                        <Typography variant="subtitle1" sx={{ textTransform: 'capitalize' }}>
                          {impact} Issues ({violations.length})
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List>
                        {violations.map((violation: AccessibilityIssue, index: number) => (
                          <React.Fragment key={violation.id}>
                            <ListItem alignItems="flex-start">
                              <ListItemIcon>
                                <Chip
                                  label={violation.impact}
                                  color={getImpactColor(violation.impact) as any}
                                  size="small"
                                />
                              </ListItemIcon>
                              <ListItemText
                                primary={violation.description}
                                secondary={
                                  <Box>
                                    <Typography variant="body2" color="text.secondary" paragraph>
                                      {violation.help}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Affected elements: {violation.nodes.length}
                                    </Typography>
                                    <Box sx={{ mt: 1 }}>
                                      <Button
                                        size="small"
                                        href={violation.helpUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        Learn More
                                      </Button>
                                    </Box>
                                  </Box>
                                }
                              />
                            </ListItem>
                            {index < violations.length - 1 && <Divider />}
                          </React.Fragment>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}

            {results.violations?.length === 0 && (
              <Alert severity="success">
                <Typography variant="body1">
                  🎉 No accessibility violations found! Your application meets the automated WCAG 2.1 AA criteria.
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Remember to also perform manual testing for complete accessibility validation.
                </Typography>
              </Alert>
            )}

            {results.incomplete?.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Incomplete Tests
                </Typography>
                <Alert severity="warning">
                  <Typography variant="body2">
                    {results.incomplete.length} tests could not be completed automatically and require manual review.
                  </Typography>
                </Alert>
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};