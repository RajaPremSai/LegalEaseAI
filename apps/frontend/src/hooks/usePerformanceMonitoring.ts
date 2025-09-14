import { useEffect, useCallback, useRef } from 'react';
import { collectPerformanceMetrics, getMemoryUsage } from '../utils/performance';

interface PerformanceMetrics {
  fcp: number;
  lcp: number;
  cls: number;
  fid: number;
  ttfb: number;
  domContentLoaded: number;
  loadComplete: number;
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

interface UsePerformanceMonitoringOptions {
  enableMemoryMonitoring?: boolean;
  enableWebVitals?: boolean;
  reportInterval?: number;
  onMetricsCollected?: (metrics: PerformanceMetrics) => void;
}

/**
 * Hook for monitoring application performance metrics
 */
export const usePerformanceMonitoring = (options: UsePerformanceMonitoringOptions = {}) => {
  const {
    enableMemoryMonitoring = true,
    enableWebVitals = true,
    reportInterval = 30000, // 30 seconds
    onMetricsCollected,
  } = options;

  const metricsRef = useRef<PerformanceMetrics>({
    fcp: 0,
    lcp: 0,
    cls: 0,
    fid: 0,
    ttfb: 0,
    domContentLoaded: 0,
    loadComplete: 0,
  });

  const lcpObserverRef = useRef<PerformanceObserver | null>(null);
  const clsObserverRef = useRef<PerformanceObserver | null>(null);
  const fidObserverRef = useRef<PerformanceObserver | null>(null);

  /**
   * Collect and report performance metrics
   */
  const collectMetrics = useCallback(() => {
    const baseMetrics = collectPerformanceMetrics();
    if (baseMetrics) {
      metricsRef.current = {
        ...metricsRef.current,
        ...baseMetrics,
      };
    }

    if (enableMemoryMonitoring) {
      const memory = getMemoryUsage();
      if (memory) {
        metricsRef.current.memory = memory;
      }
    }

    if (onMetricsCollected) {
      onMetricsCollected(metricsRef.current);
    }

    return metricsRef.current;
  }, [enableMemoryMonitoring, onMetricsCollected]);

  /**
   * Initialize Web Vitals monitoring
   */
  const initializeWebVitals = useCallback(() => {
    if (!enableWebVitals || typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }

    try {
      // Largest Contentful Paint (LCP)
      lcpObserverRef.current = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
        metricsRef.current.lcp = lastEntry.startTime;
      });
      lcpObserverRef.current.observe({ entryTypes: ['largest-contentful-paint'] });

      // Cumulative Layout Shift (CLS)
      clsObserverRef.current = new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
          }
        }
        metricsRef.current.cls = clsValue;
      });
      clsObserverRef.current.observe({ entryTypes: ['layout-shift'] });

      // First Input Delay (FID)
      fidObserverRef.current = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          metricsRef.current.fid = (entry as any).processingStart - entry.startTime;
        }
      });
      fidObserverRef.current.observe({ entryTypes: ['first-input'] });

    } catch (error) {
      console.warn('Failed to initialize Web Vitals monitoring:', error);
    }
  }, [enableWebVitals]);

  /**
   * Cleanup observers
   */
  const cleanup = useCallback(() => {
    if (lcpObserverRef.current) {
      lcpObserverRef.current.disconnect();
    }
    if (clsObserverRef.current) {
      clsObserverRef.current.disconnect();
    }
    if (fidObserverRef.current) {
      fidObserverRef.current.disconnect();
    }
  }, []);

  /**
   * Get current metrics
   */
  const getCurrentMetrics = useCallback(() => {
    return { ...metricsRef.current };
  }, []);

  /**
   * Report performance issue
   */
  const reportPerformanceIssue = useCallback((issue: {
    type: 'slow-response' | 'memory-leak' | 'layout-shift' | 'long-task';
    details: string;
    metrics?: Partial<PerformanceMetrics>;
  }) => {
    console.warn('Performance issue detected:', issue);
    
    // In production, send to analytics service
    if (process.env.NODE_ENV === 'production') {
      // Analytics service call would go here
    }
  }, []);

  useEffect(() => {
    initializeWebVitals();

    // Set up periodic metrics collection
    const interval = setInterval(collectMetrics, reportInterval);

    // Initial metrics collection
    setTimeout(collectMetrics, 1000);

    return () => {
      clearInterval(interval);
      cleanup();
    };
  }, [initializeWebVitals, collectMetrics, reportInterval, cleanup]);

  return {
    metrics: metricsRef.current,
    collectMetrics,
    getCurrentMetrics,
    reportPerformanceIssue,
  };
};

/**
 * Hook for monitoring component render performance
 */
export const useRenderPerformance = (componentName: string) => {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(0);

  useEffect(() => {
    renderCountRef.current += 1;
    const renderTime = performance.now();
    
    if (lastRenderTimeRef.current > 0) {
      const timeSinceLastRender = renderTime - lastRenderTimeRef.current;
      
      // Warn about frequent re-renders
      if (timeSinceLastRender < 16 && renderCountRef.current > 5) {
        console.warn(`${componentName} is re-rendering frequently (${renderCountRef.current} times)`);
      }
    }
    
    lastRenderTimeRef.current = renderTime;
  });

  return {
    renderCount: renderCountRef.current,
  };
};