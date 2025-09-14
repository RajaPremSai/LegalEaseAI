'use client';

import React from 'react';
import {
  Box,
  Typography,
  Button,
  Container,
  Paper,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  CloudOff,
  Refresh,
  Storage,
  CameraAlt,
  Description,
} from '@mui/icons-material';

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <CloudOff sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
        
        <Typography variant="h4" component="h1" gutterBottom>
          You're Offline
        </Typography>
        
        <Typography variant="body1" color="text.secondary" paragraph>
          It looks like you've lost your internet connection. Don't worry - you can still use some features of the Legal Document AI Assistant.
        </Typography>

        <Alert severity="info" sx={{ mb: 3, textAlign: 'left' }}>
          <Typography variant="subtitle2" gutterBottom>
            Available Offline Features:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <CameraAlt fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Capture documents with your camera" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Storage fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="View previously analyzed documents" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Description fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Browse cached document templates" />
            </ListItem>
          </List>
        </Alert>

        <Alert severity="warning" sx={{ mb: 3, textAlign: 'left' }}>
          <Typography variant="subtitle2" gutterBottom>
            Requires Internet Connection:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="• Document analysis and AI processing" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Risk assessment and recommendations" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Question & answer functionality" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Document comparison features" />
            </ListItem>
          </List>
        </Alert>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }}>
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={handleRetry}
            size="large"
          >
            Try Again
          </Button>
          
          <Button
            variant="outlined"
            onClick={handleGoHome}
            size="large"
          >
            Go Home
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          Your work will automatically sync when you're back online.
        </Typography>
      </Paper>
    </Container>
  );
}