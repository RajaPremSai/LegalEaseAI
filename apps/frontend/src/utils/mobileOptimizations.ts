'use client';

// Mobile performance optimization utilities

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLowEndDevice: boolean;
  supportsWebP: boolean;
  supportsAvif: boolean;
  connectionType: string;
  isSlowConnection: boolean;
}

export class MobileOptimizer {
  private static instance: MobileOptimizer;
  private deviceInfo: DeviceInfo;

  private constructor() {
    this.deviceInfo = this.detectDevice();
  }

  static getInstance(): MobileOptimizer {
    if (!MobileOptimizer.instance) {
      MobileOptimizer.instance = new MobileOptimizer();
    }
    return MobileOptimizer.instance;
  }

  private detectDevice(): DeviceInfo {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /ipad|android(?!.*mobile)/i.test(userAgent);
    const isDesktop = !isMobile && !isTablet;

    // Detect low-end devices based on hardware concurrency and memory
    const hardwareConcurrency = navigator.hardwareConcurrency || 1;
    const deviceMemory = (navigator as any).deviceMemory || 1;
    const isLowEndDevice = hardwareConcurrency <= 2 || deviceMemory <= 2;

    // Check image format support
    let supportsWebP = false;
    let supportsAvif = false;
    
    try {
      const canvas = document.createElement('canvas');
      const webpData = canvas.toDataURL('image/webp');
      const avifData = canvas.toDataURL('image/avif');
      
      supportsWebP = webpData && webpData.indexOf('data:image/webp') === 0;
      supportsAvif = avifData && avifData.indexOf('data:image/avif') === 0;
    } catch (error) {
      // Fallback for test environments or unsupported browsers
      supportsWebP = false;
      supportsAvif = false;
    }

    // Check connection type
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const connectionType = connection?.effectiveType || 'unknown';
    const isSlowConnection = ['slow-2g', '2g', '3g'].includes(connectionType);

    return {
      isMobile,
      isTablet,
      isDesktop,
      isLowEndDevice,
      supportsWebP,
      supportsAvif,
      connectionType,
      isSlowConnection,
    };
  }

  getDeviceInfo(): DeviceInfo {
    return this.deviceInfo;
  }

  // Optimize images based on device capabilities
  getOptimizedImageUrl(baseUrl: string, width?: number, height?: number): string {
    const { supportsAvif, supportsWebP, isLowEndDevice, isSlowConnection } = this.deviceInfo;
    
    let url = baseUrl;
    const params = new URLSearchParams();

    // Add dimensions if provided
    if (width) params.set('w', width.toString());
    if (height) params.set('h', height.toString());

    // Choose format based on support and device capabilities
    if (supportsAvif && !isLowEndDevice) {
      params.set('f', 'avif');
    } else if (supportsWebP) {
      params.set('f', 'webp');
    }

    // Adjust quality based on connection and device
    if (isSlowConnection || isLowEndDevice) {
      params.set('q', '60'); // Lower quality for slow connections
    } else {
      params.set('q', '80'); // Standard quality
    }

    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  // Lazy load images with intersection observer
  setupLazyLoading(selector: string = 'img[data-src]'): void {
    if (!('IntersectionObserver' in window)) {
      // Fallback for browsers without IntersectionObserver
      const images = document.querySelectorAll(selector);
      images.forEach((img) => {
        const element = img as HTMLImageElement;
        if (element.dataset.src) {
          element.src = element.dataset.src;
        }
      });
      return;
    }

    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          if (img.dataset.src) {
            img.src = this.getOptimizedImageUrl(img.dataset.src);
            img.classList.remove('lazy');
            imageObserver.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px 0px', // Start loading 50px before the image enters viewport
    });

    const images = document.querySelectorAll(selector);
    images.forEach((img) => imageObserver.observe(img));
  }

  // Preload critical resources
  preloadCriticalResources(resources: string[]): void {
    resources.forEach((resource) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource;
      
      // Determine resource type
      if (resource.match(/\.(woff2?|ttf|otf)$/)) {
        link.as = 'font';
        link.crossOrigin = 'anonymous';
      } else if (resource.match(/\.(jpg|jpeg|png|webp|avif)$/)) {
        link.as = 'image';
      } else if (resource.match(/\.(css)$/)) {
        link.as = 'style';
      } else if (resource.match(/\.(js)$/)) {
        link.as = 'script';
      }
      
      document.head.appendChild(link);
    });
  }

  // Optimize touch interactions
  optimizeTouchInteractions(): void {
    // Add touch-action CSS for better touch performance
    const style = document.createElement('style');
    style.textContent = `
      .touch-optimized {
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      
      .scroll-optimized {
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
      }
      
      .no-select {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
    `;
    document.head.appendChild(style);

    // Add classes to interactive elements
    const interactiveElements = document.querySelectorAll('button, a, [role="button"]');
    interactiveElements.forEach((element) => {
      element.classList.add('touch-optimized');
    });

    const scrollableElements = document.querySelectorAll('[data-scrollable]');
    scrollableElements.forEach((element) => {
      element.classList.add('scroll-optimized');
    });
  }

  // Reduce animations on low-end devices
  optimizeAnimations(): void {
    if (this.deviceInfo.isLowEndDevice) {
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Optimize bundle loading
  shouldLoadFeature(featureName: string): boolean {
    const { isLowEndDevice, isSlowConnection } = this.deviceInfo;
    
    const heavyFeatures = ['advanced-animations', 'video-backgrounds', 'complex-charts'];
    
    if ((isLowEndDevice || isSlowConnection) && heavyFeatures.includes(featureName)) {
      return false;
    }
    
    return true;
  }

  // Memory management
  cleanupUnusedResources(): void {
    // Remove unused images from DOM
    const images = document.querySelectorAll('img');
    images.forEach((img) => {
      if (!img.offsetParent && !img.dataset.keep) {
        img.src = '';
      }
    });

    // Clear unused caches
    if ('caches' in window) {
      caches.keys().then((cacheNames) => {
        cacheNames.forEach((cacheName) => {
          if (cacheName.includes('old-') || cacheName.includes('temp-')) {
            caches.delete(cacheName);
          }
        });
      });
    }
  }

  // Viewport optimization
  optimizeViewport(): void {
    // Set optimal viewport meta tag
    let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;
    
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      document.head.appendChild(viewportMeta);
    }

    const { isMobile } = this.deviceInfo;
    
    if (isMobile) {
      viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
    } else {
      viewportMeta.content = 'width=device-width, initial-scale=1';
    }
  }

  // Initialize all optimizations
  initialize(): void {
    this.optimizeViewport();
    this.optimizeTouchInteractions();
    this.optimizeAnimations();
    this.setupLazyLoading();
    
    // Preload critical resources
    this.preloadCriticalResources([
      '/icons/icon-192x192.png',
      '/manifest.json',
    ]);

    // Clean up resources periodically
    setInterval(() => {
      this.cleanupUnusedResources();
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}

// Export singleton instance
export const mobileOptimizer = MobileOptimizer.getInstance();