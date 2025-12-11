import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SettingsService } from './settings.service';
import { environment } from '../../../environments/environment';

export interface SubscriptionStatus {
  active: boolean;
  status: string;
  plan?: 'monthly' | 'yearly';
  expiresAt?: number;
  cancelAtPeriodEnd?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private readonly API_URL = environment.premiumApiUrl;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly GRACE_PERIOD = 3 * 24 * 60 * 60 * 1000; // 3 days offline grace

  private settingsService = inject(SettingsService);

  private isPremium$ = new BehaviorSubject<boolean>(false);
  private isVerifying$ = new BehaviorSubject<boolean>(false);

  /** Observable for premium status */
  get isPremiumObservable(): Observable<boolean> {
    return this.isPremium$.asObservable();
  }

  /** Current premium status (synchronous) */
  get isPremium(): boolean {
    return this.isPremium$.value;
  }

  /** Whether verification is in progress */
  get isVerifying(): Observable<boolean> {
    return this.isVerifying$.asObservable();
  }

  /**
   * Initialize subscription status from cache
   * Call this on app startup
   */
  initialize(): void {
    const settings = this.settingsService.getSettings();
    const premium = settings.premium;

    // No email configured - nothing to do
    if (!premium?.email) {
      console.log('[SubscriptionService] No premium email configured');
      return;
    }

    console.log('[SubscriptionService] Initializing with email:', premium.email);

    if (premium?.cachedStatus?.active) {
      // Check if cache is still valid or within grace period
      const now = Date.now();
      const expiresAt = premium.cachedStatus.expiresAt || 0;
      const lastVerified = premium.cachedStatus.lastVerified || 0;

      // Valid if: subscription not expired OR within grace period of last verification
      const isValid = expiresAt > now ||
        (lastVerified > 0 && (now - lastVerified) < this.GRACE_PERIOD);

      console.log('[SubscriptionService] Cache check:', { expiresAt, lastVerified, isValid, now });

      this.isPremium$.next(Boolean(isValid));

      // Trigger background verification if cache is stale
      if (lastVerified && (now - lastVerified) > this.CACHE_DURATION) {
        console.log('[SubscriptionService] Cache stale, verifying in background');
        this.verifySubscription().catch(console.error);
      }
    } else {
      // No valid cache, verify now
      console.log('[SubscriptionService] No cached status, verifying now');
      this.verifySubscription().catch(console.error);
    }
  }

  /**
   * Check subscription status
   * Uses cache first, verifies with server if stale
   */
  async checkSubscription(): Promise<boolean> {
    const settings = this.settingsService.getSettings();
    const premium = settings.premium;

    console.log('[SubscriptionService] checkSubscription called', {
      email: premium?.email,
      cachedActive: premium?.cachedStatus?.active,
      lastVerified: premium?.cachedStatus?.lastVerified
    });

    // No email configured
    if (!premium?.email) {
      console.log('[SubscriptionService] No email configured');
      this.isPremium$.next(false);
      return false;
    }

    // Check if cache is valid
    const now = Date.now();
    const lastVerified = premium.cachedStatus?.lastVerified || 0;
    const cacheValid = lastVerified && (now - lastVerified) < this.CACHE_DURATION;

    console.log('[SubscriptionService] Cache check', {
      cacheValid,
      cachedActive: premium.cachedStatus?.active,
      timeSinceVerify: lastVerified ? now - lastVerified : 'never'
    });

    if (cacheValid && premium.cachedStatus?.active) {
      console.log('[SubscriptionService] Using valid cache, isPremium=true');
      this.isPremium$.next(true);
      return true;
    }

    // Verify with server
    console.log('[SubscriptionService] Cache stale or inactive, verifying with server');
    return this.verifySubscription();
  }

  /**
   * Verify subscription status with the API
   */
  async verifySubscription(): Promise<boolean> {
    const settings = this.settingsService.getSettings();
    const premium = settings.premium;

    console.log('[SubscriptionService] verifySubscription called for:', premium?.email);

    if (!premium?.email) {
      this.isPremium$.next(false);
      return false;
    }

    this.isVerifying$.next(true);

    try {
      const status = await this.fetchSubscriptionStatus(premium.email);
      console.log('[SubscriptionService] API response:', status);

      // Update cache
      this.settingsService.updateSettings({
        premium: {
          ...premium,
          cachedStatus: {
            active: status.active,
            plan: status.plan,
            expiresAt: status.expiresAt,
            lastVerified: Date.now()
          }
        }
      });

      console.log('[SubscriptionService] Setting isPremium to:', status.active);
      this.isPremium$.next(status.active);
      return status.active;

    } catch (error) {
      console.warn('[SubscriptionService] Verification failed:', error);

      // Offline fallback: use grace period
      if (premium.cachedStatus?.active && premium.cachedStatus.expiresAt) {
        const graceEnd = premium.cachedStatus.expiresAt + this.GRACE_PERIOD;
        const isInGrace = Date.now() < graceEnd;
        this.isPremium$.next(isInGrace);
        return isInGrace;
      }

      this.isPremium$.next(false);
      return false;

    } finally {
      this.isVerifying$.next(false);
    }
  }

  /**
   * Fetch subscription status from API
   */
  private async fetchSubscriptionStatus(email: string): Promise<SubscriptionStatus> {
    const url = `${this.API_URL}/verify?email=${encodeURIComponent(email)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Verification failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Clear subscription data (for logout/reset)
   */
  clearSubscription(): void {
    const settings = this.settingsService.getSettings();

    this.settingsService.updateSettings({
      premium: {
        ...settings.premium,
        email: '',
        cachedStatus: {
          active: false
        }
      }
    });

    this.isPremium$.next(false);
  }

  /**
   * Update subscription email and verify
   */
  async setEmail(email: string): Promise<boolean> {
    const settings = this.settingsService.getSettings();

    this.settingsService.updateSettings({
      premium: {
        ...settings.premium,
        email: email.trim().toLowerCase(),
        cachedStatus: {
          active: false
        }
      }
    });

    if (email) {
      return this.verifySubscription();
    }

    this.isPremium$.next(false);
    return false;
  }
}
