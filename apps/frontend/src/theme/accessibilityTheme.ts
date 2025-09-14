import { createTheme, Theme } from '@mui/material/styles';
import { PaletteMode } from '@mui/material';

export interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  focusVisible: boolean;
}

const baseTheme = createTheme();

export const createAccessibilityTheme = (
  mode: PaletteMode = 'light',
  settings: AccessibilitySettings = {
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    focusVisible: true,
  }
): Theme => {
  const { highContrast, largeText, reducedMotion, focusVisible } = settings;

  // High contrast color palette
  const highContrastPalette = {
    light: {
      primary: {
        main: '#000000',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#0066cc',
        contrastText: '#ffffff',
      },
      background: {
        default: '#ffffff',
        paper: '#ffffff',
      },
      text: {
        primary: '#000000',
        secondary: '#333333',
      },
      divider: '#000000',
      error: {
        main: '#cc0000',
        contrastText: '#ffffff',
      },
      warning: {
        main: '#ff6600',
        contrastText: '#ffffff',
      },
      success: {
        main: '#006600',
        contrastText: '#ffffff',
      },
    },
    dark: {
      primary: {
        main: '#ffffff',
        contrastText: '#000000',
      },
      secondary: {
        main: '#66ccff',
        contrastText: '#000000',
      },
      background: {
        default: '#000000',
        paper: '#000000',
      },
      text: {
        primary: '#ffffff',
        secondary: '#cccccc',
      },
      divider: '#ffffff',
      error: {
        main: '#ff3333',
        contrastText: '#000000',
      },
      warning: {
        main: '#ffaa33',
        contrastText: '#000000',
      },
      success: {
        main: '#33cc33',
        contrastText: '#000000',
      },
    },
  };

  // Typography scaling for large text
  const getTypographyScale = (scale: number = 1) => ({
    h1: {
      fontSize: `${2.5 * scale}rem`,
      fontWeight: 600,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: `${2 * scale}rem`,
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: `${1.75 * scale}rem`,
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: `${1.5 * scale}rem`,
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: `${1.25 * scale}rem`,
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: `${1.125 * scale}rem`,
      fontWeight: 600,
      lineHeight: 1.4,
    },
    body1: {
      fontSize: `${1 * scale}rem`,
      lineHeight: 1.6,
    },
    body2: {
      fontSize: `${0.875 * scale}rem`,
      lineHeight: 1.6,
    },
    button: {
      fontSize: `${0.875 * scale}rem`,
      fontWeight: 600,
      textTransform: 'none' as const,
    },
    caption: {
      fontSize: `${0.75 * scale}rem`,
      lineHeight: 1.5,
    },
  });

  const theme = createTheme({
    palette: {
      mode,
      ...(highContrast ? highContrastPalette[mode] : {}),
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      ...getTypographyScale(largeText ? 1.25 : 1),
    },
    components: {
      // Enhanced focus indicators
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: 44, // WCAG minimum touch target size
            minWidth: 44,
            borderRadius: 8,
            ...(focusVisible && {
              '&:focus-visible': {
                outline: `3px solid ${highContrast ? '#0066cc' : baseTheme.palette.primary.main}`,
                outlineOffset: '2px',
              },
            }),
            ...(reducedMotion && {
              transition: 'none',
            }),
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            minHeight: 44,
            minWidth: 44,
            ...(focusVisible && {
              '&:focus-visible': {
                outline: `3px solid ${highContrast ? '#0066cc' : baseTheme.palette.primary.main}`,
                outlineOffset: '2px',
              },
            }),
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiInputBase-root': {
              minHeight: 44,
              ...(focusVisible && {
                '&:focus-within': {
                  outline: `3px solid ${highContrast ? '#0066cc' : baseTheme.palette.primary.main}`,
                  outlineOffset: '2px',
                },
              }),
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          select: {
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            minHeight: 32,
            ...(focusVisible && {
              '&:focus-visible': {
                outline: `3px solid ${highContrast ? '#0066cc' : baseTheme.palette.primary.main}`,
                outlineOffset: '2px',
              },
            }),
          },
        },
      },
      MuiLink: {
        styleOverrides: {
          root: {
            textDecorationThickness: '2px',
            textUnderlineOffset: '2px',
            ...(focusVisible && {
              '&:focus-visible': {
                outline: `3px solid ${highContrast ? '#0066cc' : baseTheme.palette.primary.main}`,
                outlineOffset: '2px',
                textDecoration: 'none',
              },
            }),
          },
        },
      },
      // Ensure proper contrast for alerts
      MuiAlert: {
        styleOverrides: {
          root: {
            ...(highContrast && {
              border: '2px solid',
              '&.MuiAlert-standardError': {
                borderColor: '#cc0000',
                backgroundColor: '#fff5f5',
                color: '#cc0000',
              },
              '&.MuiAlert-standardWarning': {
                borderColor: '#ff6600',
                backgroundColor: '#fffaf0',
                color: '#ff6600',
              },
              '&.MuiAlert-standardSuccess': {
                borderColor: '#006600',
                backgroundColor: '#f0fff0',
                color: '#006600',
              },
              '&.MuiAlert-standardInfo': {
                borderColor: '#0066cc',
                backgroundColor: '#f0f8ff',
                color: '#0066cc',
              },
            }),
          },
        },
      },
      // Improve table accessibility
      MuiTableCell: {
        styleOverrides: {
          root: {
            padding: '16px',
            borderBottom: `1px solid ${highContrast ? '#000000' : baseTheme.palette.divider}`,
          },
          head: {
            fontWeight: 600,
            backgroundColor: highContrast ? '#f5f5f5' : baseTheme.palette.grey[50],
          },
        },
      },
      // Enhanced paper contrast
      MuiPaper: {
        styleOverrides: {
          root: {
            ...(highContrast && {
              border: '1px solid #000000',
            }),
          },
        },
      },
      // Disable animations if reduced motion is preferred
      ...(reducedMotion && {
        MuiCollapse: {
          styleOverrides: {
            root: {
              transition: 'none',
            },
          },
        },
        MuiFade: {
          styleOverrides: {
            root: {
              transition: 'none',
            },
          },
        },
        MuiGrow: {
          styleOverrides: {
            root: {
              transition: 'none',
            },
          },
        },
        MuiSlide: {
          styleOverrides: {
            root: {
              transition: 'none',
            },
          },
        },
        MuiZoom: {
          styleOverrides: {
            root: {
              transition: 'none',
            },
          },
        },
      }),
    },
  });

  return theme;
};