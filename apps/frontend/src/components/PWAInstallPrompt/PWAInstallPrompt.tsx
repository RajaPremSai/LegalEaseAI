'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Slide,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  GetApp,
  Close,
  PhoneAndroid,
  Notifications,
  CloudDownload,
} from '@mui/icons-material';
import { usePWA } from '../../hooks/usePWA';

interface PWAInstallPromptProps {
  onDismiss?: () => void;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ onDismiss }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [dismissed, setDismissed] = useState(false);
  
  const {
    isInstallable,
    isInstalled,
    notificationsEnabled,
    installPWA,
    enableNotifications,
  } = usePWA();

  const handleInstall = async () => {
    const success = await installPWA();
    if (success) {
      setDismissed(true);
      onDismiss?.();
    }
  };

  const handleEnableNotifications = async () => {
    await enableNotifications();
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  // Don't show if already installed, dismissed, or not installable
  if (isInstalled || dismissed || !isInstallable) {
    return null;
  }

  return (
    <Slide direction="up" in={!dismissed} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          bottom: isMobile ? 16 : 24,
          left: isMobile ? 16 : 24,
          right: isMobile ? 16 : 'auto',
          zIndex: theme.zIndex.snackbar,
          maxWidth: isMobile ? 'auto' : 400,
        }}
      >
        <Card elevation={8}>
          <CardContent sx={{ pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
              <GetApp sx={{ color: 'primary.main', mr: 1, mt: 0.5 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" component="h3" gutterBottom>
                  Install Legal AI
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Get the full app experience with offline access and notifications
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={handleDismiss}
                sx={{ ml: 1, mt: -0.5 }}
              >
                <Close fontSize="small" />
              </IconButton>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PhoneAndroid sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  Works offline for document capture
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Notifications sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  Get notified when analysis is complete
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CloudDownload sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  Faster loading and better performance
                </Typography>
              </Box>
            </Box>
          </CardContent>

          <CardActions sx={{ px: 2, pb: 2 }}>
            <Button
              variant="contained"
              onClick={handleInstall}
              startIcon={<GetApp />}
              fullWidth={isMobile}
              size="small"
            >
              Install App
            </Button>
            
            {!notificationsEnabled && (
              <Button
                variant="outlined"
                onClick={handleEnableNotifications}
                startIcon={<Notifications />}
                size="small"
                sx={{ ml: 1 }}
              >
                Enable Alerts
              </Button>
            )}
          </CardActions>
        </Card>
      </Box>
    </Slide>
  );
};