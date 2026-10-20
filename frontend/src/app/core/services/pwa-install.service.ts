import { Injectable, signal } from '@angular/core';

const DISMISSED_KEY = 'casierai_install_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  readonly canInstall = signal(false);

  constructor() {
    try {
      window.addEventListener('beforeinstallprompt', (event: Event) => {
        event.preventDefault();
        this.deferredPrompt = event as BeforeInstallPromptEvent;
        this.canInstall.set(true);
      });
      window.addEventListener('appinstalled', () => {
        this.deferredPrompt = null;
        this.canInstall.set(false);
      });
    } catch {
      // Not available in this environment - the install prompt stays off.
    }
  }

  isIos(): boolean {
    try {
      const ua = window.navigator.userAgent;
      const isIosDevice = /iphone|ipad|ipod/i.test(ua);
      const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
      return isIosDevice || isIpadOs;
    } catch {
      return false;
    }
  }

  isStandalone(): boolean {
    try {
      const navigatorStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
      return window.matchMedia('(display-mode: standalone)').matches || navigatorStandalone === true;
    } catch {
      return false;
    }
  }

  isDismissed(): boolean {
    try {
      return localStorage.getItem(DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  dismiss(): void {
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // Storage unavailable - the prompt may reappear next time, which is fine.
    }
  }

  async promptInstall(): Promise<void> {
    if (!this.deferredPrompt) {
      return;
    }
    await this.deferredPrompt.prompt();
    await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.canInstall.set(false);
  }
}
