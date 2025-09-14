'use client';

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  Grid,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

export interface Risk {
  category: 'financial' | 'legal' | 'privacy' | 'operational';
  severity: 'high' | 'medium' | 'low';
  description: string;
  affectedClause: string;
  recommendation: string;
}

interface RiskVisualizationProps {
  riskScore: 'low' | 'medium' | 'high';
  risks: Risk[];
}

const getRiskColor = (severity: string) => {
  switch (severity) {
    case 'high':
      return '#f44336';
    case 'medium':
      return '#ff9800';
    case 'low':
      return '#4caf50';
    default:
      return '#9e9e9e';
  }
};

const getRiskIcon = (severity: string) => {
  switch (severity) {
    case 'high':
      return <ErrorIcon />;
    case 'medium':
      return <WarningIcon />;
    case 'low':
      return <CheckCircleIcon />;
    default:
      return <CheckCircleIcon />;
  }
};

const getRiskPercentage = (riskScore: string) => {
  switch (riskScore) {
    case 'high':
      return 85;
    case 'medium':
      return 50;
    case 'low':
      return 15;
    default:
      return 0;
  }
};

export const RiskVisualization: React.FC<RiskVisualizationProps> = ({
  riskScore,
  risks,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const riskPercentage = getRiskPercentage(riskScore);
  const riskColor = getRiskColor(riskScore);

  const riskCounts = risks.reduce(
    (acc, risk) => {
      acc[risk.severity] = (acc[risk.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <Box>
      {/* Overall Risk Score */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            {getRiskIcon(riskScore)}
            <Typography variant="h6" sx={{ ml: 1, textTransform: 'capitalize' }}>
              Overall Risk: {riskScore}
            </Typography>
          </Box>
          
          <LinearProgress
            variant="determinate"
            value={riskPercentage}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.palette.grey[200],
              '& .MuiLinearProgress-bar': {
                backgroundColor: riskColor,
                borderRadius: 4,
              },
            }}
          />
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {riskPercentage}% risk level detected
          </Typography>
        </CardContent>
      </Card>

      {/* Risk Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Risk Summary
          </Typography>
          
          <Grid container spacing={2}>
            {['high', 'medium', 'low'].map((severity) => (
              <Grid item xs={4} key={severity}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography
                    variant="h4"
                    sx={{ color: getRiskColor(severity), fontWeight: 'bold' }}
                  >
                    {riskCounts[severity] || 0}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ textTransform: 'capitalize' }}
                  >
                    {severity} Risk
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Individual Risks */}
      {risks.length > 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Identified Risks
          </Typography>
          
          {risks.map((risk, index) => (
            <Card key={index} sx={{ mb: 2 }}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: 1,
                    mb: 2,
                  }}
                >
                  <Chip
                    icon={getRiskIcon(risk.severity)}
                    label={risk.severity.toUpperCase()}
                    size="small"
                    sx={{
                      backgroundColor: getRiskColor(risk.severity),
                      color: 'white',
                      fontWeight: 'bold',
                    }}
                  />
                  
                  <Chip
                    label={risk.category.toUpperCase()}
                    size="small"
                    variant="outlined"
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Box>

                <Typography variant="body1" gutterBottom sx={{ fontWeight: 500 }}>
                  {risk.description}
                </Typography>

                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Affected Clause:</strong> {risk.affectedClause}
                </Typography>

                <Typography variant="body2" color="primary.main">
                  <strong>Recommendation:</strong> {risk.recommendation}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};