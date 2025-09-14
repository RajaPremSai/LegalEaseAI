'use client';

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: NotificationAction[];
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private registration: ServiceWorkerRegistration | null = null;

  private constructor() {}

  static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      // Check if service workers and notifications are supported
      if (!('serviceWorker' in navigator) || !('Notification' in window)) {
        console.warn('Push notifications not supported');
        return false;
      }

      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', this.registration);

      // Request notification permission
      const permission = await this.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    // Request permission
    const permission = await Notification.requestPermission();
    return permission;
  }

  async showNotification(payload: NotificationPayload): Promise<void> {
    try {
      const permission = await this.requestPermission();
      
      if (permission !== 'granted') {
        console.warn('Notification permission not granted');
        return;
      }

      const options: NotificationOptions = {
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/icon-96x96.png',
        tag: payload.tag,
        data: payload.data,
        actions: payload.actions,
        requireInteraction: true,
        vibrate: [200, 100, 200],
      };

      if (this.registration) {
        // Use service worker to show notification
        await this.registration.showNotification(payload.title, options);
      } else {
        // Fallback to regular notification
        new Notification(payload.title, options);
      }
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  async showAnalysisCompleteNotification(documentName: string): Promise<void> {
    await this.showNotification({
      title: 'Document Analysis Complete',
      body: `Analysis for "${documentName}" is ready to view`,
      icon: '/icons/icon-192x192.png',
      tag: 'analysis-complete',
      data: {
        type: 'analysis-complete',
        documentName,
        timestamp: Date.now(),
      },
      actions: [
        {
          action: 'view',
          title: 'View Results',
          icon: '/icons/view-icon.png',
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss-icon.png',
        },
      ],
    });
  }

  async showRiskAlertNotification(riskLevel: 'high' | 'medium' | 'low', documentName: string): Promise<void> {
    const riskMessages = {
      high: 'High-risk clauses detected',
      medium: 'Medium-risk clauses found',
      low: 'Low-risk analysis complete',
    };

    await this.showNotification({
      title: 'Risk Assessment Alert',
      body: `${riskMessages[riskLevel]} in "${documentName}"`,
      icon: '/icons/icon-192x192.png',
      tag: 'risk-alert',
      data: {
        type: 'risk-alert',
        riskLevel,
        documentName,
        timestamp: Date.now(),
      },
      actions: [
        {
          action: 'view-risks',
          title: 'View Risks',
          icon: '/icons/warning-icon.png',
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/icons/dismiss-icon.png',
        },
      ],
    });
  }

  async showOfflineNotification(): Promise<void> {
    await this.showNotification({
      title: 'You\'re Offline',
      body: 'Some features may be limited. Your work will sync when you\'re back online.',
      icon: '/icons/icon-192x192.png',
      tag: 'offline-status',
      data: {
        type: 'offline-status',
        timestamp: Date.now(),
      },
    });
  }

  async showOnlineNotification(): Promise<void> {
    await this.showNotification({
      title: 'Back Online',
      body: 'All features are now available. Syncing your data...',
      icon: '/icons/icon-192x192.png',
      tag: 'online-status',
      data: {
        type: 'online-status',
        timestamp: Date.now(),
      },
    });
  }

  // Subscribe to push notifications (for server-sent notifications)
  async subscribeToPush(): Promise<PushSubscription | null> {
    try {
      if (!this.registration) {
        throw new Error('Service worker not registered');
      }

      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
        ),
      });

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Check if notifications are supported and enabled
  isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  getPermissionStatus(): NotificationPermission {
    return Notification.permission;
  }
}