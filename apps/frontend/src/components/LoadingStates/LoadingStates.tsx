'use client';

import React from 'react';
import {
  Box,
  CircularProgress,
  LinearProgress,
  Typography,
  Card,
  CardContent,
  Skeleton,
  useTheme,
  keyframes,
} from '@mui/material';
import {
  Description as DocumentIcon,
  Psychology as BrainIcon,
  Assessment as AnalysisIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';

// Animated pulse effect
const pulse = keyframes`
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
`;

interface ProgressStepProps {
  label: string;
  status: 'pending' | 'active' | 'completed';
  icon: React.ReactNode;
}

const ProgressStep: React.FC<ProgressStepProps> = ({ label, status, icon }) => {
  const theme = useTheme();
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: status === 'completed' ? 'success.main' : 
                  status === 'active' ? 'primary.main' : 'grey.300',
          color: status === 'pending' ? 'grey.600' : 'white',
          animation: status === 'active' ? `${pulse} 2s ease-in-out infinite` : 'none',
        }}
      >
        {status === 'completed' ? <CheckIcon /> : icon}
      </Box>
      <Typography
        variant="body1"
        sx={{
          color: status === 'completed' ? 'success.main' : 
                 status === 'active' ? 'primary.main' : 'text.secondary',
          fontWeight: status === 'active' ? 600 : 400,
        }}
      >
        {label}
      </Typography>
      {status === 'active' && (
        <CircularProgress size={16} sx={{ ml: 'auto' }} />
      )}
    </Box>
  );
};

interface DocumentProcessingLoaderProps {
  currentStep: 'upload' | 'extract' | 'analyze' | 'complete';
  progress?: number;
  fileName?: string;
}

export const DocumentProcessingLoader: React.FC<DocumentProcessingLoaderProps> = ({
  currentStep,
  progress = 0,
  fileName,
}) => {
  const steps = [
    { key: 'upload', label: 'Uploading document', icon: <DocumentIcon /> },
    { key: 'extract', label: 'Extracting text content', icon: <DocumentIcon /> },
    { key: 'analyze', label: 'AI analysis in progress', icon: <BrainIcon /> },
    { key: 'complete', label: 'Analysis complete', icon: <AnalysisIcon /> },
  ];

  const getStepStatus = (stepKey: string): 'pending' | 'active' | 'completed' => {
    const stepIndex = steps.findIndex(s => s.key === stepKey);
    const currentIndex = steps.findIndex(s => s.key === currentStep);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <Card sx={{ maxWidth: 500, mx: 'auto' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ textAlign: 'center' }}>
          Processing Document
        </Typography>
        
        {fileName && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 3 }}>
            {fileName}
          </Typography>
        )}

        <Box sx={{ mb: 3 }}>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
            {Math.round(progress)}% complete
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {steps.map((step) => (
            <ProgressStep
              key={step.key}
              label={step.label}
              status={getStepStatus(step.key)}
              icon={step.icon}
            />
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

interface AnalysisDashboardSkeletonProps {
  showChat?: boolean;
}

export const AnalysisDashboardSkeleton: React.FC<AnalysisDashboardSkeletonProps> = ({
  showChat = false,
}) => {
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
      {/* Header Skeleton */}
      <Box sx={{ mb: 3 }}>
        <Skeleton variant="text" width="40%" height={40} />
        <Skeleton variant="text" width="60%" height={24} />
        <Skeleton variant="text" width="30%" height={20} />
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' } }}>
        {/* Main Content Skeleton */}
        <Box sx={{ flex: 1 }}>
          {/* Summary Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
                <Skeleton variant="text" width="30%" height={28} />
              </Box>
              <Skeleton variant="text" width="100%" height={20} />
              <Skeleton variant="text" width="90%" height={20} />
              <Skeleton variant="text" width="80%" height={20} />
            </CardContent>
          </Card>

          {/* Key Terms Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Skeleton variant="text" width="40%" height={28} sx={{ mb: 2 }} />
              {[1, 2, 3].map((i) => (
                <Box key={i} sx={{ mb: 2, p: 2, border: 1, borderColor: 'grey.200', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Skeleton variant="text" width="30%" height={24} />
                    <Skeleton variant="rectangular" width={60} height={20} sx={{ borderRadius: 1 }} />
                  </Box>
                  <Skeleton variant="text" width="100%" height={20} />
                  <Skeleton variant="text" width="70%" height={16} />
                </Box>
              ))}
            </CardContent>
          </Card>

          {/* Clauses Card */}
          <Card>
            <CardContent>
              <Skeleton variant="text" width="50%" height={28} sx={{ mb: 2 }} />
              {[1, 2].map((i) => (
                <Box key={i} sx={{ mb: 2, p: 2, border: 1, borderColor: 'grey.200', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Skeleton variant="text" width="40%" height={24} />
                    <Skeleton variant="rectangular" width={80} height={20} sx={{ borderRadius: 1 }} />
                  </Box>
                  <Skeleton variant="text" width="100%" height={20} />
                  <Skeleton variant="text" width="90%" height={20} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Box>

        {/* Sidebar Skeleton */}
        <Box sx={{ width: { lg: 400 } }}>
          {/* Risk Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Skeleton variant="text" width="60%" height={28} sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <Skeleton variant="circular" width={120} height={120} />
              </Box>
              <Skeleton variant="text" width="100%" height={20} />
              <Skeleton variant="text" width="80%" height={20} />
            </CardContent>
          </Card>

          {/* Recommendations Card */}
          <Card sx={{ mb: showChat ? 3 : 0 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
                <Skeleton variant="text" width="50%" height={28} />
              </Box>
              {[1, 2, 3, 4].map((i) => (
                <Box key={i} sx={{ mb: 2 }}>
                  <Skeleton variant="text" width="100%" height={20} />
                  <Skeleton variant="text" width="90%" height={20} />
                </Box>
              ))}
            </CardContent>
          </Card>

          {/* Chat Skeleton */}
          {showChat && (
            <Card>
              <CardContent>
                <Skeleton variant="text" width="70%" height={28} sx={{ mb: 2 }} />
                <Box sx={{ height: 300, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {[1, 2, 3].map((i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Skeleton variant="circular" width={32} height={32} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton variant="rectangular" width="80%" height={40} sx={{ borderRadius: 2 }} />
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Skeleton variant="rectangular" sx={{ flex: 1, height: 40, borderRadius: 1 }} />
                  <Skeleton variant="circular" width={40} height={40} />
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>
    </Box>
  );
};

interface ChatLoadingProps {
  message?: string;
}

export const ChatLoading: React.FC<ChatLoadingProps> = ({
  message = "Analyzing your question...",
}) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          bgcolor: 'grey.300',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BrainIcon sx={{ fontSize: 18 }} />
      </Box>
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: 'grey.100',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </Box>
    </Box>
  );
};

interface ComparisonLoadingProps {
  stage: 'uploading' | 'processing' | 'comparing' | 'analyzing';
  progress?: number;
}

export const ComparisonLoading: React.FC<ComparisonLoadingProps> = ({
  stage,
  progress = 0,
}) => {
  const getStageMessage = () => {
    switch (stage) {
      case 'uploading':
        return 'Uploading comparison document...';
      case 'processing':
        return 'Processing document content...';
      case 'comparing':
        return 'Comparing document versions...';
      case 'analyzing':
        return 'Analyzing changes and impact...';
      default:
        return 'Processing...';
    }
  };

  return (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <CircularProgress size={60} sx={{ mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        {getStageMessage()}
      </Typography>
      <Box sx={{ maxWidth: 400, mx: 'auto', mt: 2 }}>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ height: 6, borderRadius: 3 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {Math.round(progress)}% complete
        </Typography>
      </Box>
    </Box>
  );
};