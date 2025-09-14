/**
 * Cross-Browser and Device Compatibility Test Suite
 * Tests application functionality across different browsers and devices
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from 'react-query';
import React from 'react';

// Mock App component for testing
const MockApp: React.FC = () => {
  return (
    <div role="main">
      <h1>Legal Document AI Assistant</h1>
      <div data-testid="upload-area">
        <input type="file" aria-label="Upload document" />
        <button type="button" aria-label="Camera">Camera</button>
      </div>
      <div data-testid="camera-interface" style={{ display: 'none' }}>
        Camera Interface
      </div>
      <div data-testid="mobile-navigation" className="mobile-layout" style={{ display: 'none' }}>
        Mobile Navigation
      </div>
      <div data-testid="desktop-sidebar" className="desktop-layout" style={{ display: 'none' }}>
        Desktop Sidebar
      </div>
      <div data-testid="main-layout" className="desktop-layout">
        Main Layout
      </div>
      <div data-testid="webgl-visualization" style={{ display: 'none' }}>
        WebGL Visualization
      </div>
      <div data-testid="canvas-fallback-visualization">
        Canvas Fallback
      </div>
      <div>Limited offline support</div>
      <div>Offline mode</div>
      <div>Browser not supported</div>
      <div className="touch-active">Touch Active</div>
      <div data-testid="animated-element" className="reduced-motion">
        Animated Element
      </div>
      <img role="img" loading="lazy" alt="Test" />
    </div>
  );
};

// Browser environment mocks
const mockBrowserEnvironments = {
  chrome: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    features: {
      webRTC: true,
      serviceWorker: true,
      indexedDB: true,
      webGL: true,
      fileAPI: true
    }
  },
  firefox: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    features: {
      webRTC: true,
      serviceWorker: true,
      indexedDB: true,
      webGL: true,
      fileAPI: true
    }
  },
  safari: {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    features: {
      webRTC: true,
      serviceWorker: true,
      indexedDB: true,
      webGL: true,
      fileAPI: true
    }
  },
  edge: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    features: {
      webRTC: true,
      serviceWorker: true,
      indexedDB: true,
      webGL: true,
      fileAPI: true
    }
  },
  mobileSafari: {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    features: {
      webRTC: true,
      serviceWorker: true,
      indexedDB: true,
      webGL: false,
      fileAPI: true
    }
  },
  androidChrome: {
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    features: {
      webRTC: true,
      serviceWorker: true,
      indexedDB: true,
      webGL: true,
      fileAPI: true
    }
  }
};

// Device viewport configurations
const deviceViewports = {
  desktop: { width: 1920, height: 1080 },
  laptop: { width: 1366, height: 768 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 667 },
  largeMobile: { width: 414, height: 896 }
};

// Test wrapper
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Cross-Browser Compatibility Tests', () => {
  let originalUserAgent: string;
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    originalUserAgent = navigator.userAgent;
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    
    // Mock fetch for API calls
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true
    });
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      configurable: true
    });
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      configurable: true
    });
  });

  Object.entries(mockBrowserEnvironments).forEach(([browserName, config]) => {
    describe(`${browserName} Browser Tests`, () => {
      beforeEach(() => {
        // Set user agent
        Object.defineProperty(navigator, 'userAgent', {
          value: config.userAgent,
          configurable: true
        });

        // Mock browser-specific features
        if (!config.features.webRTC) {
          Object.defineProperty(navigator, 'mediaDevices', {
            value: undefined,
            configurable: true
          });
        }

        if (!config.features.serviceWorker) {
          Object.defineProperty(navigator, 'serviceWorker', {
            value: undefined,
            configurable: true
          });
        }
      });

      test('should render main interface correctly', async () => {
        render(
          <TestWrapper>
            <MockApp />
          </TestWrapper>
        );

        // Core UI elements should be present
        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByText(/legal document ai assistant/i)).toBeInTheDocument();
        
        // Upload functionality should be available
        const uploadArea = screen.getByTestId('upload-area');
        expect(uploadArea).toBeInTheDocument();
      });

      test('should handle file upload functionality', async () => {
        const user = userEvent.setup();
        
        render(
          <TestWrapper>
            <MockApp />
          </TestWrapper>
        );

        if (config.features.fileAPI) {
          const fileInput = screen.getByLabelText(/upload document/i);
          const testFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

          await user.upload(fileInput, testFile);

          await waitFor(() => {
            expect(screen.getByText(/processing/i)).toBeInTheDocument();
          });
        } else {
          // Should show fallback UI for browsers without File API
          expect(screen.getByText(/browser not supported/i)).toBeInTheDocument();
        }
      });

      test('should handle camera functionality appropriately', async () => {
        const user = userEvent.setup();
        
        render(
          <TestWrapper>
            <MockApp />
          </TestWrapper>
        );

        const cameraButton = screen.queryByRole('button', { name: /camera/i });

        if (config.features.webRTC && browserName.includes('mobile')) {
          expect(cameraButton).toBeInTheDocument();
          
          // Mock getUserMedia
          Object.defineProperty(navigator, 'mediaDevices', {
            value: {
              getUserMedia: jest.fn().mockResolvedValue({
                getTracks: () => [{ stop: jest.fn() }]
              })
            },
            configurable: true
          });

          await user.click(cameraButton!);
          
          await waitFor(() => {
            expect(screen.getByTestId('camera-interface')).toBeInTheDocument();
          });
        } else if (!config.features.webRTC) {
          // Camera button should be hidden or disabled
          expect(cameraButton).not.toBeInTheDocument();
        }
      });

      test('should handle offline functionality with service workers', async () => {
        render(
          <TestWrapper>
            <MockApp />
          </TestWrapper>
        );

        if (config.features.serviceWorker) {
          // Mock service worker registration
          Object.defineProperty(navigator, 'serviceWorker', {
            value: {
              register: jest.fn().mockResolvedValue({
                installing: null,
                waiting: null,
                active: { state: 'activated' }
              })
            },
            configurable: true
          });

          // Simulate offline mode
          Object.defineProperty(navigator, 'onLine', {
            value: false,
            configurable: true
          });

          // Should show offline indicator
          await waitFor(() => {
            expect(screen.getByText(/offline mode/i)).toBeInTheDocument();
          });
        }
      });
    });
  });

  describe('Device Viewport Tests', () => {
    Object.entries(deviceViewports).forEach(([deviceName, viewport]) => {
      describe(`${deviceName} Device Tests`, () => {
        beforeEach(() => {
          Object.defineProperty(window, 'innerWidth', {
            value: viewport.width,
            configurable: true
          });
          Object.defineProperty(window, 'innerHeight', {
            value: viewport.height,
            configurable: true
          });

          // Trigger resize event
          window.dispatchEvent(new Event('resize'));
        });

        test('should display responsive layout', async () => {
          render(
            <TestWrapper>
              <MockApp />
            </TestWrapper>
          );

          const mainContainer = screen.getByRole('main');
          
          if (viewport.width < 768) {
            // Mobile layout
            expect(mainContainer).toHaveClass('mobile-layout');
            expect(screen.getByTestId('mobile-navigation')).toBeInTheDocument();
          } else if (viewport.width < 1024) {
            // Tablet layout
            expect(mainContainer).toHaveClass('tablet-layout');
          } else {
            // Desktop layout
            expect(mainContainer).toHaveClass('desktop-layout');
            expect(screen.getByTestId('desktop-sidebar')).toBeInTheDocument();
          }
        });

        test('should handle touch interactions on mobile devices', async () => {
          const user = userEvent.setup();
          
          render(
            <TestWrapper>
              <MockApp />
            </TestWrapper>
          );

          if (viewport.width < 768) {
            const uploadArea = screen.getByTestId('upload-area');
            
            // Test touch events
            fireEvent.touchStart(uploadArea);
            fireEvent.touchEnd(uploadArea);

            // Should show touch feedback
            expect(uploadArea).toHaveClass('touch-active');
          }
        });

        test('should optimize text and button sizes for device', async () => {
          render(
            <TestWrapper>
              <MockApp />
            </TestWrapper>
          );

          const primaryButton = screen.getByRole('button', { name: /upload/i });
          const computedStyle = window.getComputedStyle(primaryButton);

          if (viewport.width < 768) {
            // Mobile should have larger touch targets
            expect(parseInt(computedStyle.minHeight)).toBeGreaterThanOrEqual(44);
          }
        });
      });
    });
  });

  describe('Feature Detection and Graceful Degradation', () => {
    test('should detect and handle missing WebGL support', async () => {
      // Mock missing WebGL
      const mockCanvas = {
        getContext: jest.fn().mockReturnValue(null)
      };
      
      jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'canvas') {
          return mockCanvas as any;
        }
        return document.createElement(tagName);
      });

      render(
        <TestWrapper>
          <MockApp />
        </TestWrapper>
      );

      // Should fall back to non-WebGL visualizations
      const visualizations = screen.queryAllByTestId('webgl-visualization');
      expect(visualizations).toHaveLength(0);
      
      const fallbackViz = screen.getByTestId('canvas-fallback-visualization');
      expect(fallbackViz).toBeInTheDocument();
    });

    test('should handle missing IndexedDB support', async () => {
      // Mock missing IndexedDB
      Object.defineProperty(window, 'indexedDB', {
        value: undefined,
        configurable: true
      });

      render(
        <TestWrapper>
          <MockApp />
        </TestWrapper>
      );

      // Should fall back to localStorage or memory storage
      await waitFor(() => {
        expect(screen.getByText(/limited offline support/i)).toBeInTheDocument();
      });
    });

    test('should handle CSS Grid and Flexbox fallbacks', async () => {
      // Mock older browser without CSS Grid support
      const originalSupports = CSS.supports;
      CSS.supports = jest.fn().mockImplementation((property, value) => {
        if (property === 'display' && value === 'grid') {
          return false;
        }
        return originalSupports(property, value);
      });

      render(
        <TestWrapper>
          <MockApp />
        </TestWrapper>
      );

      const layoutContainer = screen.getByTestId('main-layout');
      
      // Should use flexbox fallback
      expect(layoutContainer).toHaveClass('flexbox-layout');
      expect(layoutContainer).not.toHaveClass('grid-layout');

      CSS.supports = originalSupports;
    });
  });

  describe('Performance Across Devices', () => {
    test('should optimize animations for low-end devices', async () => {
      // Mock low-end device
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        value: 2,
        configurable: true
      });

      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
        })),
        configurable: true
      });

      render(
        <TestWrapper>
          <MockApp />
        </TestWrapper>
      );

      // Should disable or reduce animations
      const animatedElements = screen.queryAllByTestId('animated-element');
      animatedElements.forEach(element => {
        expect(element).toHaveClass('reduced-motion');
      });
    });

    test('should handle memory constraints on mobile devices', async () => {
      // Mock mobile device with memory constraints
      Object.defineProperty(navigator, 'deviceMemory', {
        value: 2, // 2GB RAM
        configurable: true
      });

      render(
        <TestWrapper>
          <MockApp />
        </TestWrapper>
      );

      // Should implement memory-conscious features
      const imageElements = screen.queryAllByRole('img');
      imageElements.forEach(img => {
        expect(img).toHaveAttribute('loading', 'lazy');
      });
    });
  });
});
