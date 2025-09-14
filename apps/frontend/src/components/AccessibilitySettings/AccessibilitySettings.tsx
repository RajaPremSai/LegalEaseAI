'use client';

import React from 'react';
import { useTranslation } from 'next-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  FormGroup,
  Button,
  Divider,
  Alert,
  Stack,
} from '@mui/material';
import {
  Accessibility as AccessibilityIcon,
  Contrast as ContrastIcon,
  TextFields as TextFieldsIcon,
  MotionPhotosOff as MotionPhotosOffIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAccessibility } from '../../contexts/AccessibilityContext';

export const AccessibilitySettings: React.FC = () => {
  const { t } = useTranslation('common');
  const {
    settings,
    toggleHighContrast,
    toggleLargeText,
    toggleReducedMotion,
    toggleFocusVisible,
    resetSettings,
  } = useAccessibility();

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <AccessibilityIcon sx={{ mr: 2, fontSize: 28 }} />
          <Typography variant="h5" component="h2">
            Accessibility Settings
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            These settings help make the application more accessible. Changes are automatically saved and will persist across sessions.
          </Typography>
        </Alert>

        <FormGroup>
          <Stack spacing={3}>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.highContrast}
                    onChange={toggleHighContrast}
                    name="highContrast"
                    inputProps={{
                      'aria-describedby': 'high-contrast-description',
                    }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ContrastIcon sx={{ mr: 1 }} />
                    <Typography variant="body1" fontWeight={500}>
                      High Contrast Mode
                    </Typography>
                  </Box>
                }
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ ml: 4, mt: 0.5 }}
                id="high-contrast-description"
              >
                Increases color contrast for better visibility. Uses black and white colors with stronger borders.
              </Typography>
            </Box>

            <Divider />

            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.largeText}
                    onChange={toggleLargeText}
                    name="largeText"
                    inputProps={{
                      'aria-describedby': 'large-text-description',
                    }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <TextFieldsIcon sx={{ mr: 1 }} />
                    <Typography variant="body1" fontWeight={500}>
                      Large Text
                    </Typography>
                  </Box>
                }
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ ml: 4, mt: 0.5 }}
                id="large-text-description"
              >
                Increases text size by 25% for better readability. Affects all text throughout the application.
              </Typography>
            </Box>

            <Divider />

            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.reducedMotion}
                    onChange={toggleReducedMotion}
                    name="reducedMotion"
                    inputProps={{
                      'aria-describedby': 'reduced-motion-description',
                    }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <MotionPhotosOffIcon sx={{ mr: 1 }} />
                    <Typography variant="body1" fontWeight={500}>
                      Reduce Motion
                    </Typography>
                  </Box>
                }
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ ml: 4, mt: 0.5 }}
                id="reduced-motion-description"
              >
                Disables animations and transitions. Helpful for users sensitive to motion or with vestibular disorders.
              </Typography>
            </Box>

            <Divider />

            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.focusVisible}
                    onChange={toggleFocusVisible}
                    name="focusVisible"
                    inputProps={{
                      'aria-describedby': 'focus-visible-description',
                    }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <VisibilityIcon sx={{ mr: 1 }} />
                    <Typography variant="body1" fontWeight={500}>
                      Enhanced Focus Indicators
                    </Typography>
                  </Box>
                }
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ ml: 4, mt: 0.5 }}
                id="focus-visible-description"
              >
                Shows clear focus outlines when navigating with keyboard. Essential for keyboard-only users.
              </Typography>
            </Box>
          </Stack>
        </FormGroup>

        <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={resetSettings}
            aria-describedby="reset-description"
          >
            Reset to Defaults
          </Button>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 1 }}
            id="reset-description"
          >
            This will restore all accessibility settings to their default values.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};