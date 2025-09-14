'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'next-i18next';
import {
  Box,
  Paper,
  Typography,
  Button,
  LinearProgress,
  Alert,
  useTheme,
  useMediaQuery,
  Divider,
  Stack,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Description as DescriptionIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { CameraCapture } from '../CameraCapture';

interface DocumentUploadProps {
  onFileUpload: (file: File) => Promise<void>;
  isUploading?: boolean;
  uploadProgress?: number;
  error?: string;
}

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onFileUpload,
  isUploading = false,
  uploadProgress = 0,
  error,
}) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        await onFileUpload(file);
      }
    },
    [onFileUpload]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: isUploading,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  const hasFileErrors = fileRejections.length > 0;
  const fileError = hasFileErrors ? fileRejections[0].errors[0] : null;

  return (
    <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto' }}>
      <Paper
        {...getRootProps()}
        elevation={dragActive || isDragActive ? 8 : 2}
        component="section"
        role="button"
        tabIndex={isUploading ? -1 : 0}
        aria-label={t('upload.title')}
        aria-describedby="upload-instructions upload-formats"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            // Trigger file input click
            const input = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
            input?.click();
          }
        }}
        sx={{
          p: isMobile ? 2 : 4,
          textAlign: 'center',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          border: `2px dashed ${
            dragActive || isDragActive
              ? theme.palette.primary.main
              : theme.palette.grey[300]
          }`,
          backgroundColor:
            dragActive || isDragActive
              ? theme.palette.primary.light + '10'
              : 'transparent',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: theme.palette.primary.main,
            backgroundColor: theme.palette.primary.light + '05',
          },
          '&:focus-visible': {
            outline: `3px solid ${theme.palette.primary.main}`,
            outlineOffset: '2px',
          },
        }}
      >
        <input 
          {...getInputProps()} 
          aria-describedby="upload-instructions upload-formats"
        />
        
        <Box sx={{ mb: 2 }}>
          <CloudUploadIcon
            sx={{
              fontSize: isMobile ? 48 : 64,
              color: dragActive || isDragActive
                ? theme.palette.primary.main
                : theme.palette.grey[400],
              mb: 1,
            }}
          />
        </Box>

        <Typography
          variant={isMobile ? 'h6' : 'h5'}
          gutterBottom
          sx={{ fontWeight: 500 }}
        >
          {isDragActive
            ? t('upload.dropHere')
            : t('upload.title')}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, px: isMobile ? 0 : 2 }}
          id="upload-instructions"
        >
          {t('upload.dragDrop')}
        </Typography>

        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ mb: 2 }}
          id="upload-formats"
        >
          {t('upload.supportedFormats')}
        </Typography>

        {!isDragActive && (
          <Stack
            direction={isMobile ? 'column' : 'row'}
            spacing={2}
            sx={{ mt: 2, alignItems: 'center' }}
          >
            <Button
              variant="outlined"
              startIcon={<DescriptionIcon />}
              disabled={isUploading}
            >
              {t('upload.chooseFile')}
            </Button>
            
            {isMobile && (
              <>
                <Divider sx={{ width: '100%' }}>
                  <Typography variant="caption" color="text.secondary">
                    {t('upload.or')}
                  </Typography>
                </Divider>
                
                <CameraCapture
                  onCapture={onFileUpload}
                  onError={(error) => console.error('Camera error:', error)}
                />
              </>
            )}
          </Stack>
        )}

        {isUploading && (
          <Box sx={{ mt: 2 }} role="status" aria-live="polite">
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {t('upload.uploading')}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={uploadProgress}
              sx={{ mt: 1, borderRadius: 1 }}
              aria-label={`Upload progress: ${Math.round(uploadProgress)}%`}
            />
            <Typography variant="caption" color="text.secondary">
              {Math.round(uploadProgress)}%
            </Typography>
          </Box>
        )}
      </Paper>

      {(error || hasFileErrors) && (
        <Alert
          severity="error"
          icon={<ErrorIcon />}
          sx={{ mt: 2 }}
        >
          {error || fileError?.message || t('upload.uploadFailed')}
        </Alert>
      )}
    </Box>
  );
};