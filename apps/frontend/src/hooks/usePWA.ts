'use client';

import { useState, useEffect, useCallback } from 'react';
import { PushNotificationService } from '../services/pushNotifications';

interface PWAState {
  isOnline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  notificationsEnabled: boolean;
  updateAvailable: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const usePWA = () => {
  const [state, setState] = useState<PWAState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isInstallable: false,
    isInstalled: false,
    notificationsEnabled: false,
    updateAvailable: false,
  });

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [notificationService] = useState(() => PushNotificationService.getInstance());

  // Check if app is installed (running in standalone mode)
  const checkInstallStatus = useCallback(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    const isInstalled = isStandalone || isInWebAppiOS;
    
    setState(prev => ({ ...prev, isInstalled }));
  }, []);

  // Handle online/offline status
  const handleOnlineStatus = useCallback(() => {
    const isOnline = navigator.onLine;
    setState(prev => ({ ...prev, isOnline }));

    if (isOnline) {
      notificationService.showOnlineNotification();
    } else {
      notificationService.showOfflineNotification();
    }
  }, [notificationService]);

  // Handle install prompt
  const handleBeforeInstallPrompt = useCallback((e: BeforeInstallPromptEvent) => {
    e.preventDefault();
    setDeferredPrompt(e);
    setState(prev => ({ ...prev, isInstallable: true }));
  }, []);

  // Handle app installed
  const handleAppInstalled = useCallback(() => {
    setDeferredPrompt(null);
    setState(prev => ({ 
      ...prev, 
      isInstallable: false, 
      isInstalled: true 
    }));
  }, []);

  // Handle service worker update
  const handleServiceWorkerUpdate = useCallback(() => {
    setState(prev => ({ ...prev, updateAvailable: true }));
  }, []);

  // Initialize PWA features
  useEffect(() => {
    checkInstallStatus();

    // Initialize push notifications
    notificationService.initialize().then((enabled) => {
      setState(prev => ({ ...prev, notificationsEnabled: enabled }));
    });

    // Add event listeners
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', handleServiceWorkerUpdate);
    }

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', handleServiceWorkerUpdate);
      }
    };
  }, [
    checkInstallStatus,
    handleOnlineStatus,
    handleBeforeInstallPrompt,
    handleAppInstalled,
    handleServiceWorkerUpdate,
    notificationService,
  ]);

  // Install the PWA
  const installPWA = useCallback(async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
        setState(prev => ({ ...prev, isInstallable: false }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error installing PWA:', error);
      return false;
    }
  }, [deferredPrompt]);

  // Enable push notifications
  const enableNotifications = useCallback(async () => {
    try {
      const enabled = await notificationService.initialize();
      if (enabled) {
        await notificationService.subscribeToPush();
      }
      setState(prev => ({ ...prev, notificationsEnabled: enabled }));
      return enabled;
    } catch (error) {
      console.error('Error enabling notifications:', error);
      return false;
    }
  }, [notificationService]);

  // Update the app
  const updateApp = useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      });
    }
  }, []);

  // Show notification
  const showNotification = useCallback(async (title: string, body: string, options?: any) => {
    await notificationService.showNotification({
      title,
      body,
      ...options,
    });
  }, [notificationService]);

  // Show analysis complete notification
  const showAnalysisCompleteNotification = useCallback(async (documentName: string) => {
    await notificationService.showAnalysisCompleteNotification(documentName);
  }, [notificationService]);

  // Show risk alert notification
  const showRiskAlertNotification = useCallback(async (
    riskLevel: 'high' | 'medium' | 'low',
    documentName: string
  ) => {
    await notificationService.showRiskAlertNotification(riskLevel, documentName);
  }, [notificationService]);

  return {
    ...state,
    installPWA,
    enableNotifications,
    updateApp,
    showNotification,
    showAnalysisCompleteNotification,
    showRiskAlertNotification,
    notificationService,
  };
};