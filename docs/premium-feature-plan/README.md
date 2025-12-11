# Premium Feature Implementation Plan

## Character Chat + Subscription System

**Created:** 2025-12-01
**Status:** Planning
**Price:** $0.99/month subscription

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Implementation Phases](#implementation-phases)
4. [Phase 1: Cloudflare Worker Backend](#phase-1-cloudflare-worker-backend)
5. [Phase 2: Stripe Configuration](#phase-2-stripe-configuration)
6. [Phase 3: Angular Subscription Service](#phase-3-angular-subscription-service)
7. [Phase 4: Character Chat Feature](#phase-4-character-chat-feature)
8. [Phase 5: UI Components](#phase-5-ui-components)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Checklist](#deployment-checklist)

---

## Overview

### Feature Summary

**Character Chat** allows users to have conversations with characters from their Codex. The AI responds in-character, with knowledge limited to what the character would know based on story progress.

### Monetization

- **Price:** $0.99/month
- **Payment Processor:** Stripe (lowest fees for micro-subscriptions)
- **Backend:** Cloudflare Workers (free tier)
- **Storage:** Cloudflare KV (free tier)

### Revenue Analysis

| Per Transaction | Amount |
|-----------------|--------|
| User Pays | $0.99 |
| Stripe Fee | $0.33 (2.9% + $0.30) |
| You Keep | $0.66 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CreativeWriter Angular App                       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────────┐ │
│  │ Character    │  │ Subscription │  │ PouchDB Settings               │ │
│  │ Chat Feature │◄─│ Guard        │◄─│ { premium: true, validUntil }  │ │
│  └──────────────┘  └──────────────┘  └────────────────────────────────┘ │
│         │                 │                        ▲                     │
│         │                 │         ┌──────────────┘                     │
│         ▼                 ▼         │                                    │
│  ┌──────────────────────────────────┴───────────────────────────────┐   │
│  │                    SubscriptionService                            │   │
│  │  • checkSubscription() - verify with cache + remote               │   │
│  │  • openCheckout() - redirect to Stripe                            │   │
│  │  • openPortal() - manage subscription                             │   │
│  └───────────────────────────────┬──────────────────────────────────┘   │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │ HTTPS
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Cloudflare Workers API                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ POST /checkout  │  │ POST /webhook   │  │ GET /verify             │  │
│  │ Create session  │  │ Handle events   │  │ Check subscription      │  │
│  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘  │
│           │                    │                        │               │
│           ▼                    ▼                        ▼               │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      Cloudflare KV Store                          │   │
│  │  email:user@example.com → "cus_xxxxx"                            │   │
│  │  stripe:cus_xxxxx → { status, currentPeriodEnd, priceId }        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              Stripe                                      │
│  • Product: "CreativeWriter Premium"                                    │
│  • Price: $0.99/month recurring                                         │
│  • Webhooks → Cloudflare Worker                                         │
│  • Customer Portal for self-service                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

| Phase | Description | Estimated Effort |
|-------|-------------|------------------|
| 1 | Cloudflare Worker Backend | Backend setup |
| 2 | Stripe Configuration | Dashboard config |
| 3 | Angular Subscription Service | Frontend integration |
| 4 | Character Chat Feature | Core feature |
| 5 | UI Components | Polish & UX |

---

## Phase 1: Cloudflare Worker Backend

### 1.1 Project Setup

Create a new Cloudflare Workers project:

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create project from Stripe template
wrangler generate creativewriter-api https://github.com/stripe-samples/stripe-node-cloudflare-worker-template

cd creativewriter-api
npm install
```

### 1.2 Configure wrangler.toml

```toml
name = "creativewriter-api"
main = "src/index.ts"
compatibility_date = "2024-12-01"

# KV Namespace binding
[[kv_namespaces]]
binding = "SUBSCRIPTIONS"
id = "<your-kv-namespace-id>"

[vars]
ALLOWED_ORIGINS = "https://creativewriter.app,http://localhost:4200"
STRIPE_PRICE_ID = "price_xxxxx"
SUCCESS_URL = "https://creativewriter.app/settings?subscription=success"
CANCEL_URL = "https://creativewriter.app/settings?subscription=cancelled"
```

### 1.3 Worker Implementation

**File: `src/index.ts`**

```typescript
import Stripe from 'stripe';

interface Env {
  STRIPE_API_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID: string;
  SUBSCRIPTIONS: KVNamespace;
  ALLOWED_ORIGINS: string;
  SUCCESS_URL: string;
  CANCEL_URL: string;
}

interface SubscriptionData {
  status: string;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  priceId?: string;
  subscriptionId?: string;
}

// Initialize Stripe with Worker-compatible HTTP client
function getStripe(env: Env): Stripe {
  return new Stripe(env.STRIPE_API_KEY, {
    apiVersion: '2024-12-18.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// CORS headers
function corsHeaders(env: Env, origin: string): HeadersInit {
  const allowed = env.ALLOWED_ORIGINS.split(',');
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// Sync Stripe data to KV (prevents split-brain issues)
async function syncStripeDataToKV(
  stripe: Stripe,
  kv: KVNamespace,
  customerId: string
): Promise<SubscriptionData> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    status: 'all',
  });

  let subData: SubscriptionData;

  if (subscriptions.data.length === 0) {
    subData = { status: 'none', currentPeriodEnd: 0, cancelAtPeriodEnd: false };
  } else {
    const sub = subscriptions.data[0];
    subData = {
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      priceId: sub.items.data[0]?.price.id,
      subscriptionId: sub.id,
    };
  }

  await kv.put(`stripe:${customerId}`, JSON.stringify(subData), {
    expirationTtl: 86400 * 30, // 30 days
  });

  return subData;
}

// Find or create Stripe customer by email
async function getOrCreateCustomer(
  stripe: Stripe,
  kv: KVNamespace,
  email: string
): Promise<string> {
  // Check KV cache first
  const cachedId = await kv.get(`email:${email}`);
  if (cachedId) return cachedId;

  // Search Stripe
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) {
    const customerId = existing.data[0].id;
    await kv.put(`email:${email}`, customerId);
    return customerId;
  }

  // Create new customer
  const customer = await stripe.customers.create({ email });
  await kv.put(`email:${email}`, customer.id);
  return customer.id;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(env, origin);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    const stripe = getStripe(env);

    try {
      // POST /api/checkout - Create checkout session
      if (url.pathname === '/api/checkout' && request.method === 'POST') {
        const { email } = await request.json() as { email: string };

        if (!email) {
          return Response.json({ error: 'Email required' }, { status: 400, headers });
        }

        const customerId = await getOrCreateCustomer(stripe, env.SUBSCRIPTIONS, email);

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          line_items: [{
            price: env.STRIPE_PRICE_ID,
            quantity: 1,
          }],
          success_url: env.SUCCESS_URL,
          cancel_url: env.CANCEL_URL,
          subscription_data: {
            metadata: { email },
          },
        });

        return Response.json({ url: session.url }, { headers });
      }

      // POST /api/webhook - Handle Stripe events
      if (url.pathname === '/api/webhook' && request.method === 'POST') {
        const body = await request.text();
        const signature = request.headers.get('Stripe-Signature');

        if (!signature) {
          return Response.json({ error: 'Missing signature' }, { status: 400 });
        }

        // CRITICAL: Use constructEventAsync for Cloudflare Workers!
        const event = await stripe.webhooks.constructEventAsync(
          body,
          signature,
          env.STRIPE_WEBHOOK_SECRET
        );

        const relevantEvents = [
          'checkout.session.completed',
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'invoice.paid',
          'invoice.payment_failed',
        ];

        if (relevantEvents.includes(event.type)) {
          const obj = event.data.object as any;
          const customerId = obj.customer as string;

          if (customerId) {
            await syncStripeDataToKV(stripe, env.SUBSCRIPTIONS, customerId);
          }
        }

        return Response.json({ received: true });
      }

      // GET /api/verify - Check subscription status
      if (url.pathname === '/api/verify' && request.method === 'GET') {
        const email = url.searchParams.get('email');

        if (!email) {
          return Response.json({ error: 'Email required' }, { status: 400, headers });
        }

        const customerId = await env.SUBSCRIPTIONS.get(`email:${email}`);

        if (!customerId) {
          return Response.json({
            active: false,
            status: 'none'
          }, { headers });
        }

        // Try KV cache first
        let subData: SubscriptionData | null = null;
        const cached = await env.SUBSCRIPTIONS.get(`stripe:${customerId}`);

        if (cached) {
          subData = JSON.parse(cached);
        } else {
          // Fetch from Stripe and cache
          subData = await syncStripeDataToKV(stripe, env.SUBSCRIPTIONS, customerId);
        }

        const isActive = subData.status === 'active' || subData.status === 'trialing';

        return Response.json({
          active: isActive,
          status: subData.status,
          expiresAt: subData.currentPeriodEnd * 1000, // Convert to JS timestamp
          cancelAtPeriodEnd: subData.cancelAtPeriodEnd,
        }, { headers });
      }

      // GET /api/portal - Get customer portal URL
      if (url.pathname === '/api/portal' && request.method === 'GET') {
        const email = url.searchParams.get('email');

        if (!email) {
          return Response.json({ error: 'Email required' }, { status: 400, headers });
        }

        const customerId = await env.SUBSCRIPTIONS.get(`email:${email}`);

        if (!customerId) {
          return Response.json({ error: 'Customer not found' }, { status: 404, headers });
        }

        const session = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: env.SUCCESS_URL.replace('?subscription=success', ''),
        });

        return Response.json({ url: session.url }, { headers });
      }

      return Response.json({ error: 'Not found' }, { status: 404, headers });

    } catch (error) {
      console.error('Worker error:', error);
      return Response.json(
        { error: error instanceof Error ? error.message : 'Internal error' },
        { status: 500, headers }
      );
    }
  },
};
```

### 1.4 Deploy Worker

```bash
# Create KV namespace
wrangler kv:namespace create SUBSCRIPTIONS
# Note the ID and add to wrangler.toml

# Add secrets
wrangler secret put STRIPE_API_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET

# Deploy
wrangler deploy

# Note your worker URL: https://creativewriter-api.<your-subdomain>.workers.dev
```

---

## Phase 2: Stripe Configuration

### 2.1 Create Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Complete account setup and verification

### 2.2 Create Product and Price

**In Stripe Dashboard:**

1. Go to **Products** → **Add Product**
2. Configure:
   - **Name:** CreativeWriter Premium
   - **Description:** Unlock Character Chat and premium features
   - **Pricing:** $0.99 USD / month (recurring)
3. Save and note the **Price ID** (starts with `price_`)

### 2.3 Configure Webhook

1. Go to **Developers** → **Webhooks** → **Add endpoint**
2. Configure:
   - **Endpoint URL:** `https://creativewriter-api.<subdomain>.workers.dev/api/webhook`
   - **Events to send:**
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
3. Save and note the **Webhook Secret** (starts with `whsec_`)

### 2.4 Configure Customer Portal

1. Go to **Settings** → **Billing** → **Customer portal**
2. Enable:
   - Cancel subscriptions
   - Update payment methods
   - View invoices
3. Save configuration

### 2.5 Recommended Settings

1. Go to **Settings** → **Subscriptions and emails**
2. Enable: **Limit customers to one subscription**
3. Disable: **Cash App Pay** (high fraud rate)

---

## Phase 3: Angular Subscription Service

### 3.1 Update Settings Interface

**File: `src/app/core/models/settings.interface.ts`**

Add premium fields:

```typescript
export interface Settings {
  // ... existing fields ...

  // Premium subscription
  premium?: PremiumSettings;
}

export interface PremiumSettings {
  email?: string;           // Email used for subscription
  active: boolean;          // Is subscription active
  status: string;           // 'active', 'canceled', 'past_due', 'none'
  expiresAt?: number;       // Timestamp when subscription expires
  lastVerified?: number;    // When we last checked with server
  cancelAtPeriodEnd?: boolean;
}
```

### 3.2 Create Subscription Service

**File: `src/app/core/services/subscription.service.ts`**

```typescript
import { Injectable, inject } from '@angular/core';
import { SettingsService } from './settings.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SubscriptionStatus {
  active: boolean;
  status: string;
  expiresAt?: number;
  cancelAtPeriodEnd?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private readonly API_URL = environment.subscriptionApiUrl;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly GRACE_PERIOD = 3 * 24 * 60 * 60 * 1000; // 3 days offline grace

  private settingsService = inject(SettingsService);

  private isPremium$ = new BehaviorSubject<boolean>(false);

  get isPremiumObservable(): Observable<boolean> {
    return this.isPremium$.asObservable();
  }

  /**
   * Check if user has active premium subscription
   * Uses local cache first, then verifies with server
   */
  async checkSubscription(): Promise<boolean> {
    const settings = await this.settingsService.getSettings();
    const premium = settings.premium;

    // No subscription email set
    if (!premium?.email) {
      this.isPremium$.next(false);
      return false;
    }

    // Check if cache is still valid
    const now = Date.now();
    const cacheValid = premium.lastVerified &&
      (now - premium.lastVerified) < this.CACHE_DURATION;

    if (cacheValid && premium.active) {
      this.isPremium$.next(true);
      return true;
    }

    // Try to verify with server
    try {
      const status = await this.verifyWithServer(premium.email);
      await this.updateLocalCache(premium.email, status);
      this.isPremium$.next(status.active);
      return status.active;
    } catch (error) {
      // Offline - use grace period
      console.warn('Subscription verification failed, using cache:', error);

      if (premium.active && premium.expiresAt) {
        // Allow access if within grace period of expiration
        const graceEnd = premium.expiresAt + this.GRACE_PERIOD;
        const isInGrace = now < graceEnd;
        this.isPremium$.next(isInGrace);
        return isInGrace;
      }

      this.isPremium$.next(false);
      return false;
    }
  }

  /**
   * Verify subscription status with server
   */
  private async verifyWithServer(email: string): Promise<SubscriptionStatus> {
    const response = await fetch(
      `${this.API_URL}/verify?email=${encodeURIComponent(email)}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(`Verification failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Update local cache with subscription status
   */
  private async updateLocalCache(
    email: string,
    status: SubscriptionStatus
  ): Promise<void> {
    await this.settingsService.updateSettings({
      premium: {
        email,
        active: status.active,
        status: status.status,
        expiresAt: status.expiresAt,
        cancelAtPeriodEnd: status.cancelAtPeriodEnd,
        lastVerified: Date.now(),
      }
    });
  }

  /**
   * Open Stripe checkout for subscription
   */
  async openCheckout(email: string): Promise<void> {
    const response = await fetch(`${this.API_URL}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      throw new Error(`Checkout failed: ${response.status}`);
    }

    const { url } = await response.json();

    // Save email for later verification
    await this.settingsService.updateSettings({
      premium: {
        email,
        active: false,
        status: 'pending',
        lastVerified: Date.now(),
      }
    });

    // Redirect to Stripe
    window.open(url, '_blank');
  }

  /**
   * Open Stripe customer portal for subscription management
   */
  async openCustomerPortal(): Promise<void> {
    const settings = await this.settingsService.getSettings();
    const email = settings.premium?.email;

    if (!email) {
      throw new Error('No subscription email found');
    }

    const response = await fetch(
      `${this.API_URL}/portal?email=${encodeURIComponent(email)}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(`Portal access failed: ${response.status}`);
    }

    const { url } = await response.json();
    window.open(url, '_blank');
  }

  /**
   * Handle return from Stripe checkout
   */
  async handleCheckoutReturn(success: boolean): Promise<void> {
    if (success) {
      // Re-verify subscription status
      await this.checkSubscription();
    }
  }
}
```

### 3.3 Create Premium Guard

**File: `src/app/core/guards/premium.guard.ts`**

```typescript
import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { SubscriptionService } from '../services/subscription.service';

@Injectable({
  providedIn: 'root'
})
export class PremiumGuard implements CanActivate {
  private subscriptionService = inject(SubscriptionService);
  private router = inject(Router);

  async canActivate(): Promise<boolean> {
    const isPremium = await this.subscriptionService.checkSubscription();

    if (!isPremium) {
      // Redirect to upgrade page or show modal
      this.router.navigate(['/settings'], {
        queryParams: { upgrade: 'character-chat' }
      });
      return false;
    }

    return true;
  }
}
```

### 3.4 Add Environment Variable

**File: `src/environments/environment.ts`**

```typescript
export const environment = {
  production: false,
  subscriptionApiUrl: 'http://localhost:8787/api', // Local wrangler dev
};
```

**File: `src/environments/environment.prod.ts`**

```typescript
export const environment = {
  production: true,
  subscriptionApiUrl: 'https://creativewriter-api.<subdomain>.workers.dev/api',
};
```

---

## Phase 4: Character Chat Feature

### 4.1 Create Character Chat Interfaces

**File: `src/app/stories/models/character-chat.interface.ts`**

```typescript
export interface CharacterChatMessage {
  role: 'user' | 'character';
  content: string;
  timestamp: Date;
}

export interface CharacterChatSession {
  id: string;
  storyId: string;
  characterId: string;
  characterName: string;
  knowledgeCutoff: KnowledgeCutoff;
  messages: CharacterChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeCutoff {
  type: 'full' | 'chapter' | 'scene';
  chapterId?: string;
  chapterNumber?: number;
  sceneId?: string;
  sceneNumber?: number;
}

export interface CharacterContext {
  character: CodexEntry;
  relatedEntries: CodexEntry[];
  storyContent: string;
  knowledgeSummary: string;
}
```

### 4.2 Create Character Chat Service

**File: `src/app/stories/services/character-chat.service.ts`**

```typescript
import { Injectable, inject } from '@angular/core';
import { CodexService } from './codex.service';
import { StoryService } from './story.service';
import { BeatAIService } from '../../shared/services/beat-ai.service';
import { PromptManagerService } from '../../shared/services/prompt-manager.service';
import { CodexEntry, StoryRole } from '../models/codex.interface';
import { Story, Chapter, Scene } from '../models/story.interface';
import {
  CharacterChatMessage,
  CharacterChatSession,
  KnowledgeCutoff,
  CharacterContext
} from '../models/character-chat.interface';

@Injectable({
  providedIn: 'root'
})
export class CharacterChatService {
  private codexService = inject(CodexService);
  private storyService = inject(StoryService);
  private beatAIService = inject(BeatAIService);
  private promptManager = inject(PromptManagerService);

  /**
   * Get all characters from a story's codex that can be chatted with
   */
  async getChattableCharacters(storyId: string): Promise<CodexEntry[]> {
    const codex = await this.codexService.getCodexByStoryId(storyId);
    if (!codex) return [];

    const characters: CodexEntry[] = [];

    for (const category of codex.categories) {
      for (const entry of category.entries) {
        // Include entries with character-like story roles
        if (entry.storyRole && entry.storyRole !== StoryRole.Background) {
          characters.push(entry);
        }
      }
    }

    return characters;
  }

  /**
   * Build context for a character based on knowledge cutoff
   */
  async buildCharacterContext(
    storyId: string,
    characterId: string,
    cutoff: KnowledgeCutoff
  ): Promise<CharacterContext> {
    const story = await this.storyService.getStory(storyId);
    const codex = await this.codexService.getCodexByStoryId(storyId);

    if (!story || !codex) {
      throw new Error('Story or codex not found');
    }

    // Find the character
    let character: CodexEntry | null = null;
    const relatedEntries: CodexEntry[] = [];

    for (const category of codex.categories) {
      for (const entry of category.entries) {
        if (entry.id === characterId) {
          character = entry;
        } else if (this.isRelatedToCharacter(entry, characterId)) {
          relatedEntries.push(entry);
        }
      }
    }

    if (!character) {
      throw new Error('Character not found');
    }

    // Build story content up to cutoff point
    const storyContent = this.buildStoryContentUpTo(story, cutoff);

    // Generate knowledge summary
    const knowledgeSummary = this.generateKnowledgeSummary(cutoff, story);

    return {
      character,
      relatedEntries,
      storyContent,
      knowledgeSummary,
    };
  }

  /**
   * Send a message to a character and get their response
   */
  async sendMessage(
    session: CharacterChatSession,
    userMessage: string,
    context: CharacterContext,
    modelId: string
  ): Promise<string> {
    const systemPrompt = this.buildCharacterSystemPrompt(context, session);
    const conversationHistory = this.formatConversationHistory(session.messages);

    const fullPrompt = `${systemPrompt}

## Conversation History
${conversationHistory}

## User's Message
${userMessage}

## Your Response (as ${context.character.title})
Respond in character, staying true to ${context.character.title}'s personality, knowledge, and way of speaking. Remember, you only know what has happened up to ${context.knowledgeSummary}.`;

    // Use the beat AI service for generation
    const response = await this.beatAIService.generateWithModel(
      fullPrompt,
      modelId,
      { maxTokens: 1000 }
    );

    return response;
  }

  /**
   * Build the system prompt for character roleplay
   */
  private buildCharacterSystemPrompt(
    context: CharacterContext,
    session: CharacterChatSession
  ): string {
    const { character, relatedEntries, storyContent, knowledgeSummary } = context;

    let prompt = `You are roleplaying as ${character.title}, a character from a story.
You must respond as this character would, based on their personality, background, and knowledge.

## Character Profile
Name: ${character.title}
Role: ${character.storyRole || 'Character'}

### Description
${character.content}

## Knowledge Boundaries
IMPORTANT: You only know events and information up to ${knowledgeSummary}.
Do NOT reference or hint at any events that happen after this point.
If asked about future events, respond as the character genuinely not knowing.

## Related Characters and Locations
${relatedEntries.map(e => `- ${e.title}: ${e.content.substring(0, 200)}...`).join('\n')}

## Story Context (What You Know)
${storyContent}

## Roleplay Guidelines
1. Stay in character at all times
2. Use speech patterns and vocabulary appropriate for ${character.title}
3. Reference specific events from the story that ${character.title} experienced
4. Show appropriate emotions based on relationships and past events
5. If you don't know something (as the character), say so naturally
6. Do not break the fourth wall or acknowledge being an AI`;

    return prompt;
  }

  /**
   * Build story content up to the specified cutoff
   */
  private buildStoryContentUpTo(story: Story, cutoff: KnowledgeCutoff): string {
    let content = '';

    for (const chapter of story.chapters) {
      if (cutoff.type === 'chapter' &&
          cutoff.chapterNumber &&
          chapter.chapterNumber > cutoff.chapterNumber) {
        break;
      }

      content += `\n## Chapter ${chapter.chapterNumber}: ${chapter.title}\n`;

      for (const scene of chapter.scenes) {
        if (cutoff.type === 'scene' &&
            cutoff.chapterId === chapter.id &&
            cutoff.sceneNumber &&
            scene.sceneNumber > cutoff.sceneNumber) {
          break;
        }

        // Use summary if available, otherwise truncate content
        const sceneText = scene.summary ||
          this.truncateContent(scene.content, 500);
        content += `\n### Scene ${scene.sceneNumber}: ${scene.title}\n${sceneText}\n`;
      }
    }

    return content;
  }

  /**
   * Generate a human-readable knowledge summary
   */
  private generateKnowledgeSummary(cutoff: KnowledgeCutoff, story: Story): string {
    if (cutoff.type === 'full') {
      return 'the end of the story';
    }

    if (cutoff.type === 'chapter' && cutoff.chapterNumber) {
      const chapter = story.chapters.find(c => c.chapterNumber === cutoff.chapterNumber);
      return `the end of Chapter ${cutoff.chapterNumber}${chapter ? ` (${chapter.title})` : ''}`;
    }

    if (cutoff.type === 'scene' && cutoff.chapterId && cutoff.sceneNumber) {
      const chapter = story.chapters.find(c => c.id === cutoff.chapterId);
      if (chapter) {
        const scene = chapter.scenes.find(s => s.sceneNumber === cutoff.sceneNumber);
        return `Scene ${cutoff.sceneNumber} of Chapter ${chapter.chapterNumber}${scene ? ` (${scene.title})` : ''}`;
      }
    }

    return 'an unspecified point in the story';
  }

  /**
   * Check if a codex entry is related to a character
   */
  private isRelatedToCharacter(entry: CodexEntry, characterId: string): boolean {
    // Check tags for character reference
    if (entry.tags?.some(tag => tag.includes(characterId))) {
      return true;
    }
    // Could expand this with more sophisticated relationship detection
    return false;
  }

  /**
   * Format conversation history for the prompt
   */
  private formatConversationHistory(messages: CharacterChatMessage[]): string {
    if (messages.length === 0) {
      return '(This is the start of the conversation)';
    }

    return messages.map(msg => {
      const role = msg.role === 'user' ? 'User' : 'Character';
      return `${role}: ${msg.content}`;
    }).join('\n\n');
  }

  /**
   * Truncate content to a maximum length
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }
}
```

### 4.3 Create Character Chat Component

**File: `src/app/stories/components/character-chat/character-chat.component.ts`**

```typescript
import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { CharacterChatService } from '../../services/character-chat.service';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { CodexEntry } from '../../models/codex.interface';
import { Story, Chapter } from '../../models/story.interface';
import {
  CharacterChatMessage,
  CharacterChatSession,
  KnowledgeCutoff,
  CharacterContext
} from '../../models/character-chat.interface';

@Component({
  selector: 'app-character-chat',
  templateUrl: './character-chat.component.html',
  styleUrls: ['./character-chat.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class CharacterChatComponent implements OnInit {
  @Input() story!: Story;

  private characterChatService = inject(CharacterChatService);
  private subscriptionService = inject(SubscriptionService);
  private modalController = inject(ModalController);

  // State
  characters: CodexEntry[] = [];
  selectedCharacter: CodexEntry | null = null;
  selectedCutoff: KnowledgeCutoff = { type: 'full' };

  messages: CharacterChatMessage[] = [];
  currentMessage = '';
  isLoading = false;
  isPremium = false;

  context: CharacterContext | null = null;

  async ngOnInit() {
    // Check premium status
    this.isPremium = await this.subscriptionService.checkSubscription();

    if (this.isPremium) {
      // Load available characters
      this.characters = await this.characterChatService.getChattableCharacters(
        this.story.id
      );
    }
  }

  async selectCharacter(character: CodexEntry) {
    this.selectedCharacter = character;
    this.messages = [];

    // Build context for this character
    this.context = await this.characterChatService.buildCharacterContext(
      this.story.id,
      character.id,
      this.selectedCutoff
    );
  }

  async updateCutoff(cutoff: KnowledgeCutoff) {
    this.selectedCutoff = cutoff;

    if (this.selectedCharacter) {
      // Rebuild context with new cutoff
      this.context = await this.characterChatService.buildCharacterContext(
        this.story.id,
        this.selectedCharacter.id,
        cutoff
      );
    }
  }

  async sendMessage() {
    if (!this.currentMessage.trim() || !this.selectedCharacter || !this.context) {
      return;
    }

    const userMessage = this.currentMessage.trim();
    this.currentMessage = '';
    this.isLoading = true;

    // Add user message to chat
    this.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    try {
      // Get character response
      const session: CharacterChatSession = {
        id: crypto.randomUUID(),
        storyId: this.story.id,
        characterId: this.selectedCharacter.id,
        characterName: this.selectedCharacter.title,
        knowledgeCutoff: this.selectedCutoff,
        messages: this.messages,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = await this.characterChatService.sendMessage(
        session,
        userMessage,
        this.context,
        'claude-3-5-sonnet' // Or get from settings
      );

      // Add character response
      this.messages.push({
        role: 'character',
        content: response,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to get character response:', error);
      // Show error toast
    } finally {
      this.isLoading = false;
    }
  }

  async openUpgradeModal() {
    // Show upgrade prompt
    const settings = await this.settingsService.getSettings();
    // Navigate to settings or show inline upgrade
  }

  dismiss() {
    this.modalController.dismiss();
  }
}
```

### 4.4 Create Component Template

**File: `src/app/stories/components/character-chat/character-chat.component.html`**

```html
<ion-header>
  <ion-toolbar>
    <ion-title>
      <span *ngIf="!selectedCharacter">Character Chat</span>
      <span *ngIf="selectedCharacter">Chat with {{ selectedCharacter.title }}</span>
    </ion-title>
    <ion-buttons slot="end">
      <ion-button (click)="dismiss()">
        <ion-icon name="close"></ion-icon>
      </ion-button>
    </ion-buttons>
  </ion-toolbar>
</ion-header>

<ion-content>
  <!-- Premium Gate -->
  <div *ngIf="!isPremium" class="premium-gate">
    <ion-icon name="lock-closed" class="lock-icon"></ion-icon>
    <h2>Premium Feature</h2>
    <p>Character Chat is a premium feature. Subscribe for just $0.99/month to unlock.</p>
    <ion-button (click)="openUpgradeModal()" expand="block">
      Upgrade to Premium
    </ion-button>
  </div>

  <!-- Character Selection -->
  <div *ngIf="isPremium && !selectedCharacter" class="character-selection">
    <h3>Select a Character to Chat With</h3>

    <ion-list>
      <ion-item *ngFor="let character of characters"
                (click)="selectCharacter(character)"
                button>
        <ion-avatar slot="start" *ngIf="character.imageUrl">
          <img [src]="character.imageUrl" [alt]="character.title">
        </ion-avatar>
        <ion-icon slot="start" name="person" *ngIf="!character.imageUrl"></ion-icon>
        <ion-label>
          <h2>{{ character.title }}</h2>
          <p>{{ character.storyRole }}</p>
        </ion-label>
      </ion-item>
    </ion-list>

    <div *ngIf="characters.length === 0" class="no-characters">
      <p>No characters found in your Codex.</p>
      <p>Add characters with a Story Role to chat with them.</p>
    </div>
  </div>

  <!-- Chat Interface -->
  <div *ngIf="isPremium && selectedCharacter" class="chat-interface">
    <!-- Knowledge Cutoff Selector -->
    <div class="cutoff-selector">
      <ion-label>Character knows up to:</ion-label>
      <ion-select [(ngModel)]="selectedCutoff.type"
                  (ionChange)="updateCutoff(selectedCutoff)">
        <ion-select-option value="full">End of story</ion-select-option>
        <ion-select-option value="chapter">Specific chapter</ion-select-option>
      </ion-select>

      <ion-select *ngIf="selectedCutoff.type === 'chapter'"
                  [(ngModel)]="selectedCutoff.chapterNumber"
                  (ionChange)="updateCutoff(selectedCutoff)">
        <ion-select-option *ngFor="let chapter of story.chapters"
                           [value]="chapter.chapterNumber">
          Chapter {{ chapter.chapterNumber }}: {{ chapter.title }}
        </ion-select-option>
      </ion-select>
    </div>

    <!-- Messages -->
    <div class="messages-container">
      <div *ngFor="let message of messages"
           class="message"
           [class.user]="message.role === 'user'"
           [class.character]="message.role === 'character'">
        <div class="message-header">
          <span class="sender">
            {{ message.role === 'user' ? 'You' : selectedCharacter.title }}
          </span>
          <span class="time">{{ message.timestamp | date:'shortTime' }}</span>
        </div>
        <div class="message-content">{{ message.content }}</div>
      </div>

      <div *ngIf="isLoading" class="message character loading">
        <ion-spinner name="dots"></ion-spinner>
        <span>{{ selectedCharacter.title }} is thinking...</span>
      </div>
    </div>

    <!-- Input -->
    <div class="input-container">
      <ion-textarea
        [(ngModel)]="currentMessage"
        placeholder="Ask {{ selectedCharacter.title }} something..."
        [autoGrow]="true"
        [rows]="1"
        [maxlength]="2000"
        (keydown.enter)="$event.shiftKey || sendMessage(); $event.shiftKey || $event.preventDefault()">
      </ion-textarea>
      <ion-button (click)="sendMessage()"
                  [disabled]="!currentMessage.trim() || isLoading">
        <ion-icon name="send"></ion-icon>
      </ion-button>
    </div>
  </div>
</ion-content>
```

### 4.5 Create Component Styles

**File: `src/app/stories/components/character-chat/character-chat.component.scss`**

```scss
.premium-gate {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
  text-align: center;

  .lock-icon {
    font-size: 4rem;
    color: var(--ion-color-medium);
    margin-bottom: 1rem;
  }

  h2 {
    margin-bottom: 0.5rem;
  }

  p {
    color: var(--ion-color-medium);
    margin-bottom: 1.5rem;
  }
}

.character-selection {
  padding: 1rem;

  h3 {
    margin-bottom: 1rem;
  }

  .no-characters {
    text-align: center;
    padding: 2rem;
    color: var(--ion-color-medium);
  }
}

.chat-interface {
  display: flex;
  flex-direction: column;
  height: 100%;

  .cutoff-selector {
    padding: 0.5rem 1rem;
    background: var(--ion-color-light);
    border-bottom: 1px solid var(--ion-color-medium-shade);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;

    ion-label {
      font-size: 0.9rem;
    }
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .message {
    max-width: 80%;
    padding: 0.75rem 1rem;
    border-radius: 1rem;

    &.user {
      align-self: flex-end;
      background: var(--ion-color-primary);
      color: var(--ion-color-primary-contrast);
      border-bottom-right-radius: 0.25rem;
    }

    &.character {
      align-self: flex-start;
      background: var(--ion-color-light);
      border-bottom-left-radius: 0.25rem;
    }

    &.loading {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-style: italic;
      color: var(--ion-color-medium);
    }

    .message-header {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      opacity: 0.7;
      margin-bottom: 0.25rem;
    }

    .message-content {
      white-space: pre-wrap;
    }
  }

  .input-container {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-top: 1px solid var(--ion-color-medium-shade);
    background: var(--ion-background-color);

    ion-textarea {
      flex: 1;
      --padding-start: 1rem;
      --padding-end: 1rem;
      --background: var(--ion-color-light);
      border-radius: 1rem;
    }

    ion-button {
      --border-radius: 50%;
      --padding-start: 0.75rem;
      --padding-end: 0.75rem;
    }
  }
}
```

---

## Phase 5: UI Components

### 5.1 Upgrade Prompt Component

**File: `src/app/shared/components/upgrade-prompt/upgrade-prompt.component.ts`**

```typescript
import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { SubscriptionService } from '../../../core/services/subscription.service';

@Component({
  selector: 'app-upgrade-prompt',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Upgrade to Premium</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="upgrade-content">
        <ion-icon name="star" class="premium-icon"></ion-icon>

        <h2>CreativeWriter Premium</h2>
        <p class="price">Just <strong>$0.99/month</strong></p>

        <ion-list class="features-list">
          <ion-item>
            <ion-icon name="chatbubbles" slot="start" color="primary"></ion-icon>
            <ion-label>
              <h3>Character Chat</h3>
              <p>Interview your characters and explore their personalities</p>
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-icon name="sparkles" slot="start" color="primary"></ion-icon>
            <ion-label>
              <h3>More Features Coming</h3>
              <p>New premium features added regularly</p>
            </ion-label>
          </ion-item>
        </ion-list>

        <div class="email-input">
          <ion-item>
            <ion-label position="floating">Email for subscription</ion-label>
            <ion-input type="email" [(ngModel)]="email" placeholder="your@email.com"></ion-input>
          </ion-item>
        </div>

        <ion-button expand="block"
                    (click)="subscribe()"
                    [disabled]="!isValidEmail() || isLoading">
          <ion-spinner *ngIf="isLoading" name="crescent"></ion-spinner>
          <span *ngIf="!isLoading">Subscribe Now</span>
        </ion-button>

        <p class="terms">
          Cancel anytime. Powered by Stripe.
        </p>
      </div>
    </ion-content>
  `,
  styles: [`
    .upgrade-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 1rem;
    }

    .premium-icon {
      font-size: 4rem;
      color: var(--ion-color-warning);
      margin-bottom: 1rem;
    }

    .price {
      font-size: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .features-list {
      width: 100%;
      margin-bottom: 1.5rem;
    }

    .email-input {
      width: 100%;
      margin-bottom: 1rem;
    }

    .terms {
      font-size: 0.8rem;
      color: var(--ion-color-medium);
      margin-top: 1rem;
    }
  `],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class UpgradePromptComponent {
  @Input() featureName = 'Premium Features';

  private subscriptionService = inject(SubscriptionService);
  private modalController = inject(ModalController);
  private toastController = inject(ToastController);

  email = '';
  isLoading = false;

  isValidEmail(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
  }

  async subscribe() {
    if (!this.isValidEmail()) return;

    this.isLoading = true;

    try {
      await this.subscriptionService.openCheckout(this.email);
      this.dismiss();
    } catch (error) {
      const toast = await this.toastController.create({
        message: 'Failed to open checkout. Please try again.',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.isLoading = false;
    }
  }

  dismiss() {
    this.modalController.dismiss();
  }
}
```

### 5.2 Subscription Status Component (for Settings)

**File: `src/app/settings/components/subscription-status/subscription-status.component.ts`**

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { SettingsService } from '../../../core/services/settings.service';
import { PremiumSettings } from '../../../core/models/settings.interface';

@Component({
  selector: 'app-subscription-status',
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon name="star" color="warning"></ion-icon>
          Premium Subscription
        </ion-card-title>
      </ion-card-header>

      <ion-card-content>
        <!-- Active Subscription -->
        <div *ngIf="premium?.active" class="subscription-active">
          <ion-badge color="success">Active</ion-badge>
          <p>Subscribed as: {{ premium.email }}</p>
          <p *ngIf="premium.expiresAt">
            {{ premium.cancelAtPeriodEnd ? 'Expires' : 'Renews' }}:
            {{ premium.expiresAt | date:'mediumDate' }}
          </p>
          <p *ngIf="premium.cancelAtPeriodEnd" class="cancel-notice">
            Your subscription will not renew.
          </p>

          <ion-button fill="outline" (click)="manageSubscription()">
            Manage Subscription
          </ion-button>

          <ion-button fill="clear" (click)="refreshStatus()">
            <ion-icon name="refresh" slot="start"></ion-icon>
            Refresh Status
          </ion-button>
        </div>

        <!-- No Subscription -->
        <div *ngIf="!premium?.active" class="subscription-inactive">
          <p>Unlock premium features for just $0.99/month</p>
          <ul>
            <li>Character Chat - Interview your characters</li>
            <li>More features coming soon</li>
          </ul>

          <ion-button expand="block" (click)="upgrade()">
            Subscribe Now - $0.99/month
          </ion-button>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    ion-card-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .subscription-active {
      ion-badge {
        margin-bottom: 0.5rem;
      }

      .cancel-notice {
        color: var(--ion-color-warning);
        font-style: italic;
      }
    }

    .subscription-inactive {
      ul {
        margin: 1rem 0;
        padding-left: 1.5rem;
      }
    }
  `],
  standalone: true,
  imports: [CommonModule, IonicModule],
})
export class SubscriptionStatusComponent implements OnInit {
  private subscriptionService = inject(SubscriptionService);
  private settingsService = inject(SettingsService);
  private toastController = inject(ToastController);

  premium: PremiumSettings | null = null;

  async ngOnInit() {
    await this.loadStatus();
  }

  async loadStatus() {
    const settings = await this.settingsService.getSettings();
    this.premium = settings.premium || null;
  }

  async refreshStatus() {
    await this.subscriptionService.checkSubscription();
    await this.loadStatus();

    const toast = await this.toastController.create({
      message: 'Subscription status updated',
      duration: 2000,
    });
    await toast.present();
  }

  async manageSubscription() {
    try {
      await this.subscriptionService.openCustomerPortal();
    } catch (error) {
      const toast = await this.toastController.create({
        message: 'Failed to open subscription portal',
        duration: 3000,
        color: 'danger',
      });
      await toast.present();
    }
  }

  async upgrade() {
    // Open upgrade modal or navigate to upgrade flow
    // Implementation depends on your routing setup
  }
}
```

---

## Testing Strategy

### Unit Tests

1. **SubscriptionService Tests**
   - Cache validation logic
   - Offline grace period handling
   - API error handling

2. **CharacterChatService Tests**
   - Character context building
   - Knowledge cutoff filtering
   - Prompt construction

3. **Component Tests**
   - Premium gate rendering
   - Character selection
   - Message sending flow

### Integration Tests

1. **Stripe Webhook Tests**
   - Mock webhook events
   - Verify KV updates
   - Test signature validation

2. **End-to-End Flow**
   - Checkout → Webhook → Verification
   - Subscription cancellation
   - Expired subscription handling

### Manual Testing Checklist

- [ ] Stripe test mode checkout
- [ ] Webhook delivery in test mode
- [ ] Subscription verification
- [ ] Offline access with cache
- [ ] Grace period after expiration
- [ ] Customer portal access
- [ ] Character chat with different cutoffs

---

## Deployment Checklist

### Pre-Deployment

- [ ] Stripe account verified and live mode enabled
- [ ] Product and price created in Stripe
- [ ] Webhook endpoint configured
- [ ] Customer portal configured
- [ ] Cloudflare Worker deployed with secrets
- [ ] Environment variables updated for production

### Deployment Steps

1. Deploy Cloudflare Worker to production
2. Update Angular environment.prod.ts with Worker URL
3. Build and deploy Angular app
4. Test end-to-end flow in production
5. Monitor Stripe dashboard for first transactions

### Post-Deployment

- [ ] Verify webhook delivery in Stripe dashboard
- [ ] Test subscription flow with real card
- [ ] Test cancellation flow
- [ ] Monitor error rates in Cloudflare dashboard
- [ ] Set up Stripe email notifications

---

## Related Documents

- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Stripe Subscription Docs](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe + Cloudflare Template](https://github.com/stripe-samples/stripe-node-cloudflare-worker-template)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-12-01 | Claude | Initial plan created |
