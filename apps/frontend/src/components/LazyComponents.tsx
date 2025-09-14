import { Suspense, ComponentType } from 'react';
import { CircularProgress, Box } from '@mui/material';
import { dynamicImport } from '../utils/performance';

/**
 * Loading component for lazy-loaded components
 */
const LoadingFallback = ({ message = 'Loading...' }: { message?: string }) => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="200px"
    flexDirection="column"
    gap={2}
  >
    <CircularProgress />
    <Box component="span" sx={{ color: 'text.secondary' }}>
      {message}
    </Box>
  </Box>
);

/**
 * Higher-order component for lazy loading with suspense
 */
export const withLazyLoading = <P extends object>(
  Component: ComponentType<P>,
  loadingMessage?: string
) => {
  return (props: P) => (
    <Suspense fallback={<LoadingFallback message={loadingMessage} />}>
      <Component {...props} />
    </Suspense>
  );
};

// Lazy-loaded components
export const LazyAnalysisDashboard = dynamicImport(
  () => import('./AnalysisDashboard'),
  {
    loading: () => <LoadingFallback message="Loading analysis dashboard..." />,
  }
);

export const LazyChatInterface = dynamicImport(
  () => import('./ChatInterface'),
  {
    loading: () => <LoadingFallback message="Loading chat interface..." />,
  }
);

export const LazyDocumentComparison = dynamicImport(
  () => import('./DocumentComparison'),
  {
    loading: () => <LoadingFallback message="Loading document comparison..." />,
  }
);

export const LazyDocumentUpload = dynamicImport(
  () => import('./DocumentUpload'),
  {
    loading: () => <LoadingFallback message="Loading upload interface..." />,
  }
);

export const LazyTemplateLibrary = dynamicImport(
  () => import('./TemplateLibrary'),
  {
    loading: () => <LoadingFallback message="Loading template library..." />,
  }
);

export const LazyCameraCapture = dynamicImport(
  () => import('./CameraCapture'),
  {
    loading: () => <LoadingFallback message="Loading camera..." />,
    ssr: false, // Camera requires client-side rendering
  }
);

export const LazyAccessibilitySettings = dynamicImport(
  () => import('./AccessibilitySettings'),
  {
    loading: () => <LoadingFallback message="Loading accessibility settings..." />,
  }
);

// Route-level lazy components
export const LazyComparePage = dynamicImport(
  () => import('../app/compare/page'),
  {
    loading: () => <LoadingFallback message="Loading comparison page..." />,
  }
);

export const LazyOfflinePage = dynamicImport(
  () => import('../app/offline/page'),
  {
    loading: () => <LoadingFallback message="Loading offline page..." />,
    ssr: false,
  }
);

/**
 * Preload components for better performance
 */
export const preloadComponents = () => {
  if (typeof window !== 'undefined') {
    // Preload critical components after initial load
    setTimeout(() => {
      import('./AnalysisDashboard');
      import('./ChatInterface');
      import('./DocumentUpload');
    }, 2000);

    // Preload secondary components after user interaction
    const preloadSecondary = () => {
      import('./DocumentComparison');
      import('./TemplateLibrary');
      import('./AccessibilitySettings');
    };

    // Preload on user interaction
    document.addEventListener('mouseover', preloadSecondary, { once: true });
    document.addEventListener('touchstart', preloadSecondary, { once: true });
  }
};