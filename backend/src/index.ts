import Stripe from 'stripe';

// Subscription plan types
type PlanType = 'monthly' | 'yearly';

// Environment bindings
interface Env {
  // Secrets (set via wrangler secret put)
  STRIPE_API_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID_MONTHLY: string;
  STRIPE_PRICE_ID_YEARLY: string;

  // KV Namespace
  SUBSCRIPTIONS: KVNamespace;

  // Environment variables
  SUCCESS_URL: string;
  CANCEL_URL: string;
}

// Subscription data stored in KV
interface SubscriptionData {
  status: string;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  priceId?: string;
  subscriptionId?: string;
  plan?: PlanType;
}

// API response types
interface VerifyResponse {
  active: boolean;
  status: string;
  expiresAt?: number;
  cancelAtPeriodEnd?: boolean;
  plan?: PlanType;
}

interface PricesResponse {
  monthly: { priceId: string; amount: number; currency: string };
  yearly: { priceId: string; amount: number; currency: string };
}

interface CheckoutResponse {
  url: string;
}

interface PortalResponse {
  url: string;
}

interface ErrorResponse {
  error: string;
}

// Initialize Stripe with Worker-compatible HTTP client
function getStripe(env: Env): Stripe {
  return new Stripe(env.STRIPE_API_KEY, {
    apiVersion: '2025-02-24.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// CORS headers for cross-origin requests
// Allow any origin since the app is self-hosted by customers
function corsHeaders(_env: Env, origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// JSON response helper
function jsonResponse<T>(data: T, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}

// Determine plan type from price ID
function getPlanFromPriceId(priceId: string | undefined, env: Env): PlanType | undefined {
  if (!priceId) return undefined;
  if (priceId === env.STRIPE_PRICE_ID_MONTHLY) return 'monthly';
  if (priceId === env.STRIPE_PRICE_ID_YEARLY) return 'yearly';
  return undefined;
}

// Get price ID from plan type
function getPriceIdFromPlan(plan: PlanType, env: Env): string {
  return plan === 'yearly' ? env.STRIPE_PRICE_ID_YEARLY : env.STRIPE_PRICE_ID_MONTHLY;
}

/**
 * Sync Stripe subscription data to KV
 * This single function prevents "split-brain" issues by always fetching fresh data
 */
async function syncStripeDataToKV(
  stripe: Stripe,
  kv: KVNamespace,
  customerId: string,
  env: Env
): Promise<SubscriptionData> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    status: 'all',
  });

  let subData: SubscriptionData;

  if (subscriptions.data.length === 0) {
    subData = {
      status: 'none',
      currentPeriodEnd: 0,
      cancelAtPeriodEnd: false,
    };
  } else {
    const sub = subscriptions.data[0];
    const priceId = sub.items.data[0]?.price.id;
    subData = {
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      priceId,
      subscriptionId: sub.id,
      plan: getPlanFromPriceId(priceId, env),
    };
  }

  // Cache for 30 days (will be updated by webhooks)
  await kv.put(`stripe:${customerId}`, JSON.stringify(subData), {
    expirationTtl: 86400 * 30,
  });

  return subData;
}

/**
 * Find existing Stripe customer or create new one
 */
async function getOrCreateCustomer(
  stripe: Stripe,
  kv: KVNamespace,
  email: string
): Promise<string> {
  // Check KV cache first
  const cachedId = await kv.get(`email:${email.toLowerCase()}`);
  if (cachedId) {
    return cachedId;
  }

  // Search Stripe for existing customer
  const existing = await stripe.customers.list({
    email: email.toLowerCase(),
    limit: 1,
  });

  if (existing.data.length > 0) {
    const customerId = existing.data[0].id;
    await kv.put(`email:${email.toLowerCase()}`, customerId);
    return customerId;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email: email.toLowerCase(),
  });

  await kv.put(`email:${email.toLowerCase()}`, customer.id);
  return customer.id;
}

/**
 * Handle POST /api/checkout - Create Stripe checkout session
 */
async function handleCheckout(
  request: Request,
  env: Env,
  headers: HeadersInit
): Promise<Response> {
  const body = await request.json() as {
    email?: string;
    plan?: PlanType;
    successUrl?: string;
    cancelUrl?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const plan: PlanType = body.plan === 'yearly' ? 'yearly' : 'monthly';

  // Use provided URLs or fall back to env defaults
  const successUrl = body.successUrl || env.SUCCESS_URL;
  const cancelUrl = body.cancelUrl || env.CANCEL_URL;

  if (!email || !email.includes('@')) {
    return jsonResponse<ErrorResponse>(
      { error: 'Valid email required' },
      400,
      headers
    );
  }

  const stripe = getStripe(env);
  const customerId = await getOrCreateCustomer(stripe, env.SUBSCRIPTIONS, email);

  // Check if customer already has an active subscription
  const existingSubs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1,
  });

  if (existingSubs.data.length > 0) {
    return jsonResponse<ErrorResponse>(
      { error: 'You already have an active subscription' },
      400,
      headers
    );
  }

  const priceId = getPriceIdFromPlan(plan, env);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { email, plan },
    },
    // Allow promotion codes
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return jsonResponse<ErrorResponse>(
      { error: 'Failed to create checkout session' },
      500,
      headers
    );
  }

  return jsonResponse<CheckoutResponse>({ url: session.url }, 200, headers);
}

/**
 * Handle GET /api/prices - Get available subscription prices
 */
async function handlePrices(
  env: Env,
  headers: HeadersInit
): Promise<Response> {
  return jsonResponse<PricesResponse>(
    {
      monthly: {
        priceId: env.STRIPE_PRICE_ID_MONTHLY,
        amount: 99, // $0.99 in cents
        currency: 'usd',
      },
      yearly: {
        priceId: env.STRIPE_PRICE_ID_YEARLY,
        amount: 999, // $9.99 in cents
        currency: 'usd',
      },
    },
    200,
    headers
  );
}

/**
 * Handle POST /api/webhook - Process Stripe webhook events
 */
async function handleWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get('Stripe-Signature');

  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  const stripe = getStripe(env);
  let event: Stripe.Event;

  try {
    // CRITICAL: Use constructEventAsync for Cloudflare Workers!
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  // Events that affect subscription status
  const relevantEvents = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.paused',
    'customer.subscription.resumed',
    'invoice.paid',
    'invoice.payment_failed',
  ];

  if (relevantEvents.includes(event.type)) {
    const obj = event.data.object as Stripe.Subscription | Stripe.Invoice | Stripe.Checkout.Session;
    const customerId = typeof obj.customer === 'string'
      ? obj.customer
      : obj.customer?.id;

    if (customerId) {
      console.log(`Processing ${event.type} for customer ${customerId}`);
      await syncStripeDataToKV(stripe, env.SUBSCRIPTIONS, customerId, env);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handle GET /api/verify - Check subscription status
 */
async function handleVerify(
  request: Request,
  env: Env,
  headers: HeadersInit
): Promise<Response> {
  const url = new URL(request.url);
  const email = url.searchParams.get('email')?.trim().toLowerCase();

  if (!email) {
    return jsonResponse<ErrorResponse>(
      { error: 'Email required' },
      400,
      headers
    );
  }

  const stripe = getStripe(env);

  // Look up customer ID by email (check cache first, then Stripe)
  let customerId = await env.SUBSCRIPTIONS.get(`email:${email}`);

  if (!customerId) {
    // Customer not in cache - search Stripe directly
    // This handles cases where customers were created directly in Stripe
    // or where the cache was cleared
    const existing = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (existing.data.length > 0) {
      customerId = existing.data[0].id;
      // Cache the email -> customerId mapping
      await env.SUBSCRIPTIONS.put(`email:${email}`, customerId);
    } else {
      // No customer exists in Stripe for this email
      return jsonResponse<VerifyResponse>(
        { active: false, status: 'none' },
        200,
        headers
      );
    }
  }

  // Try to get cached subscription data
  const cached = await env.SUBSCRIPTIONS.get(`stripe:${customerId}`);
  let subData: SubscriptionData;

  if (cached) {
    subData = JSON.parse(cached);
    // Ensure plan is set (for backwards compatibility with cached data)
    if (!subData.plan && subData.priceId) {
      subData.plan = getPlanFromPriceId(subData.priceId, env);
    }
  } else {
    // Fetch from Stripe and cache
    subData = await syncStripeDataToKV(stripe, env.SUBSCRIPTIONS, customerId, env);
  }

  const isActive = subData.status === 'active' || subData.status === 'trialing';

  return jsonResponse<VerifyResponse>(
    {
      active: isActive,
      status: subData.status,
      expiresAt: subData.currentPeriodEnd * 1000, // Convert to JS timestamp
      cancelAtPeriodEnd: subData.cancelAtPeriodEnd,
      plan: subData.plan,
    },
    200,
    headers
  );
}

/**
 * Handle GET /api/portal - Get customer portal URL
 */
async function handlePortal(
  request: Request,
  env: Env,
  headers: HeadersInit
): Promise<Response> {
  const url = new URL(request.url);
  const email = url.searchParams.get('email')?.trim().toLowerCase();

  if (!email) {
    return jsonResponse<ErrorResponse>(
      { error: 'Email required' },
      400,
      headers
    );
  }

  const customerId = await env.SUBSCRIPTIONS.get(`email:${email}`);

  if (!customerId) {
    return jsonResponse<ErrorResponse>(
      { error: 'No subscription found for this email' },
      404,
      headers
    );
  }

  const stripe = getStripe(env);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: env.SUCCESS_URL.replace('?subscription=success', ''),
  });

  return jsonResponse<PortalResponse>({ url: session.url }, 200, headers);
}

/**
 * Handle GET /api/health - Health check endpoint
 */
function handleHealth(headers: HeadersInit): Response {
  return jsonResponse(
    { status: 'ok', timestamp: new Date().toISOString() },
    200,
    headers
  );
}

/**
 * Check if email has active subscription (helper for premium modules)
 * This mirrors the verification logic from handleVerify to ensure consistency
 */
async function isSubscriptionActive(
  email: string,
  env: Env
): Promise<boolean> {
  const stripe = getStripe(env);

  // Look up customer ID by email (check cache first, then Stripe)
  let customerId = await env.SUBSCRIPTIONS.get(`email:${email}`);

  if (!customerId) {
    // Customer not in cache - search Stripe directly
    const existing = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (existing.data.length > 0) {
      customerId = existing.data[0].id;
      // Cache the email -> customerId mapping
      await env.SUBSCRIPTIONS.put(`email:${email}`, customerId);
    } else {
      // No customer exists in Stripe for this email
      return false;
    }
  }

  // Try to get cached subscription data
  const cached = await env.SUBSCRIPTIONS.get(`stripe:${customerId}`);
  let subData: SubscriptionData;

  if (cached) {
    subData = JSON.parse(cached);
  } else {
    // Fetch from Stripe and cache
    subData = await syncStripeDataToKV(stripe, env.SUBSCRIPTIONS, customerId, env);
  }

  return subData.status === 'active' || subData.status === 'trialing';
}

/**
 * Handle GET /api/premium/character-chat - Serve premium Character Chat module
 * Only serves to verified subscribers
 */
async function handlePremiumCharacterChat(
  request: Request,
  env: Env,
  headers: HeadersInit
): Promise<Response> {
  const url = new URL(request.url);
  const email = url.searchParams.get('email')?.trim().toLowerCase();

  if (!email) {
    return jsonResponse<ErrorResponse>(
      { error: 'Email required' },
      400,
      headers
    );
  }

  // Verify subscription
  const isActive = await isSubscriptionActive(email, env);
  if (!isActive) {
    return jsonResponse<ErrorResponse>(
      { error: 'Premium subscription required' },
      403,
      headers
    );
  }

  // Return the Character Chat module
  // This is the actual premium feature code that only subscribers can access
  const moduleCode = getCharacterChatModule();

  return new Response(moduleCode, {
    status: 200,
    headers: {
      ...headers,
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store', // Don't cache - always verify subscription
    },
  });
}

/**
 * Character Chat Module Code
 * This is served only to verified premium subscribers
 */
function getCharacterChatModule(): string {
  return `
// Character Chat Premium Module
// This code is only served to verified premium subscribers

export class CharacterChatService {
  constructor(aiService) {
    this.aiService = aiService;
  }

  /**
   * Build system prompt for character chat
   */
  buildSystemPrompt(character, storyContext, knowledgeCutoff) {
    const characterInfo = this.formatCharacterInfo(character);
    const contextInfo = knowledgeCutoff
      ? this.buildContextWithCutoff(storyContext, knowledgeCutoff)
      : this.buildFullContext(storyContext);

    return \`You are roleplaying as \${character.name} from a story. Stay completely in character.

CHARACTER PROFILE:
\${characterInfo}

STORY CONTEXT (what your character knows):
\${contextInfo}

IMPORTANT RULES:
- Respond as \${character.name} would, based on their personality, background, and knowledge
- Only reference events and information your character would know about
- Stay consistent with the character's voice, mannerisms, and speech patterns
- If asked about something your character wouldn't know, respond as the character would to unknown information
- Never break character or acknowledge you are an AI
- Keep responses conversational and natural\`;
  }

  /**
   * Format character information for the prompt
   */
  formatCharacterInfo(character) {
    let info = \`Name: \${character.name}\\n\`;

    if (character.description) {
      info += \`Description: \${character.description}\\n\`;
    }
    if (character.personality) {
      info += \`Personality: \${character.personality}\\n\`;
    }
    if (character.background) {
      info += \`Background: \${character.background}\\n\`;
    }
    if (character.goals) {
      info += \`Goals: \${character.goals}\\n\`;
    }
    if (character.relationships) {
      info += \`Relationships: \${character.relationships}\\n\`;
    }
    if (character.notes) {
      info += \`Additional Notes: \${character.notes}\\n\`;
    }

    return info;
  }

  /**
   * Build full story context from all scene summaries
   * Used when no knowledge cutoff is specified
   */
  buildFullContext(storyContext) {
    // If a pre-built summary exists, use it
    if (storyContext.summary) {
      return storyContext.summary;
    }

    // Otherwise build from chapters and scenes
    if (!storyContext.chapters || storyContext.chapters.length === 0) {
      return '';
    }

    return storyContext.chapters
      .sort((a, b) => a.order - b.order)
      .map(ch => {
        const sceneSummaries = ch.scenes
          ?.sort((a, b) => a.order - b.order)
          .filter(s => s.summary)
          .map(s => \`  - \${s.title}: \${s.summary}\`)
          .join('\\n') || '';

        return \`Chapter: \${ch.title}\\n\${sceneSummaries || '  (no scene summaries available)'}\`;
      })
      .join('\\n\\n');
  }

  /**
   * Build story context with knowledge cutoff
   * Character only knows events up to a certain chapter/scene
   */
  buildContextWithCutoff(storyContext, cutoff) {
    if (!cutoff || !storyContext.chapters) {
      return this.buildFullContext(storyContext);
    }

    // Filter and format chapters up to cutoff with all scene summaries
    const relevantChapters = storyContext.chapters
      .filter(ch => ch.order <= cutoff.chapterOrder)
      .sort((a, b) => a.order - b.order)
      .map(ch => {
        let scenes = ch.scenes || [];

        // If this is the cutoff chapter, filter scenes up to the cutoff scene
        if (cutoff.sceneOrder && ch.order === cutoff.chapterOrder) {
          scenes = scenes.filter(s => s.order <= cutoff.sceneOrder);
        }

        // Format scene summaries
        const sceneSummaries = scenes
          .sort((a, b) => a.order - b.order)
          .filter(s => s.summary)
          .map(s => \`  - \${s.title}: \${s.summary}\`)
          .join('\\n');

        return \`Chapter: \${ch.title}\\n\${sceneSummaries || '  (no scene summaries available)'}\`;
      })
      .join('\\n\\n');

    return relevantChapters;
  }

  /**
   * Send a message to the character and get a response
   */
  async chat(character, message, conversationHistory, storyContext, knowledgeCutoff, modelId) {
    const systemPrompt = this.buildSystemPrompt(character, storyContext, knowledgeCutoff);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    const response = await this.aiService.generateChatResponse(messages, modelId);
    return response;
  }

  /**
   * Get suggested conversation starters based on character and story language
   */
  getSuggestedStarters(character, language = 'en') {
    // Language-specific starter templates
    const templates = {
      en: {
        intro: \`Tell me about yourself, \${character.name}.\`,
        mind: "What's on your mind lately?",
        situation: "How do you feel about the current situation?",
        goals: "What are you hoping to achieve?",
        relationships: "Tell me about the people in your life.",
        background: "What was your life like before all this?"
      },
      de: {
        intro: \`Erzähl mir von dir, \${character.name}.\`,
        mind: "Was beschäftigt dich in letzter Zeit?",
        situation: "Wie fühlst du dich bei der aktuellen Situation?",
        goals: "Was erhoffst du dir zu erreichen?",
        relationships: "Erzähl mir von den Menschen in deinem Leben.",
        background: "Wie war dein Leben vor all dem?"
      },
      fr: {
        intro: \`Parle-moi de toi, \${character.name}.\`,
        mind: "Qu'est-ce qui te préoccupe ces derniers temps?",
        situation: "Comment te sens-tu par rapport à la situation actuelle?",
        goals: "Qu'espères-tu accomplir?",
        relationships: "Parle-moi des gens dans ta vie.",
        background: "Comment était ta vie avant tout ça?"
      },
      es: {
        intro: \`Cuéntame sobre ti, \${character.name}.\`,
        mind: "¿Qué tienes en mente últimamente?",
        situation: "¿Cómo te sientes sobre la situación actual?",
        goals: "¿Qué esperas lograr?",
        relationships: "Cuéntame sobre las personas en tu vida.",
        background: "¿Cómo era tu vida antes de todo esto?"
      }
    };

    // Fall back to English for custom or unknown languages
    const t = templates[language] || templates.en;

    const starters = [t.intro, t.mind, t.situation];

    if (character.goals) {
      starters.push(t.goals);
    }
    if (character.relationships) {
      starters.push(t.relationships);
    }
    if (character.background) {
      starters.push(t.background);
    }

    return starters;
  }
}

// Export the service class
export default CharacterChatService;
`;
}

/**
 * Handle GET /api/premium/beat-rewrite - Serve premium Beat Rewrite module
 * Only serves to verified subscribers
 */
async function handlePremiumBeatRewrite(
  request: Request,
  env: Env,
  headers: HeadersInit
): Promise<Response> {
  const url = new URL(request.url);
  const email = url.searchParams.get('email')?.trim().toLowerCase();

  if (!email) {
    return jsonResponse<ErrorResponse>(
      { error: 'Email required' },
      400,
      headers
    );
  }

  // Verify subscription
  const isActive = await isSubscriptionActive(email, env);
  if (!isActive) {
    return jsonResponse<ErrorResponse>(
      { error: 'Premium subscription required' },
      403,
      headers
    );
  }

  // Return the Beat Rewrite module
  const moduleCode = getBeatRewriteModule();

  return new Response(moduleCode, {
    status: 200,
    headers: {
      ...headers,
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store', // Don't cache - always verify subscription
    },
  });
}

/**
 * Beat Rewrite Module Code
 * This is served only to verified premium subscribers
 */
function getBeatRewriteModule(): string {
  return `
// Beat Rewrite Premium Module
// This code is only served to verified premium subscribers

export class BeatRewriteService {
  constructor(aiService) {
    this.aiService = aiService;
  }

  /**
   * Build a context-aware rewrite prompt
   */
  buildRewritePrompt(originalText, instruction, context = {}) {
    let prompt = '';

    // Add story context if available
    if (context.storyOutline) {
      prompt += '<story-context>\\n' + context.storyOutline + '\\n</story-context>\\n\\n';
    }

    // Add scene context if available
    if (context.sceneContext) {
      prompt += '<scene-context>\\n' + context.sceneContext + '\\n</scene-context>\\n\\n';
    }

    // Add codex entries (characters, locations, etc.) if available
    if (context.codexEntries) {
      prompt += '<world-info>\\n' + context.codexEntries + '\\n</world-info>\\n\\n';
    }

    // Add the original text to rewrite
    prompt += '<original-text>\\n' + originalText + '\\n</original-text>\\n\\n';

    // Add the rewrite instruction
    prompt += '<rewrite-instruction>\\n' + instruction + '\\n</rewrite-instruction>\\n\\n';

    // Final instruction
    prompt += 'Please rewrite the original text according to the instruction. ';
    prompt += 'Maintain consistency with any provided story context and world information. ';
    prompt += 'Preserve the narrative voice and style of the original. ';
    prompt += 'Return ONLY the rewritten text, nothing else - no explanations, no markdown formatting, just the rewritten prose.';

    return prompt;
  }

  /**
   * Execute a rewrite using the AI service
   */
  async rewrite(originalText, instruction, context, modelId) {
    const prompt = this.buildRewritePrompt(originalText, instruction, context);
    const messages = [{ role: 'user', content: prompt }];
    return await this.aiService.generateChatResponse(messages, modelId);
  }

  /**
   * Get suggested rewrite prompts based on language
   */
  getSuggestedPrompts(text, language = 'en') {
    const prompts = {
      en: [
        'Make it more dramatic',
        'Write it more emotionally',
        'Shorten it',
        'Expand with more details',
        'Make it more formal',
        'Make it more casual',
        'Improve the pacing',
        'Add more sensory details',
        'Make the dialogue more natural',
        'Increase the tension'
      ],
      de: [
        'Dramatischer gestalten',
        'Emotionaler schreiben',
        'Kürzer fassen',
        'Mit mehr Details erweitern',
        'Formeller formulieren',
        'Lockerer formulieren',
        'Tempo verbessern',
        'Mehr sensorische Details hinzufügen',
        'Dialog natürlicher gestalten',
        'Spannung erhöhen'
      ],
      fr: [
        'Rendre plus dramatique',
        'Écrire plus émotionnellement',
        'Raccourcir',
        'Développer avec plus de détails',
        'Rendre plus formel',
        'Rendre plus décontracté',
        'Améliorer le rythme',
        'Ajouter plus de détails sensoriels',
        'Rendre le dialogue plus naturel',
        'Augmenter la tension'
      ],
      es: [
        'Hacerlo más dramático',
        'Escribirlo más emocionalmente',
        'Acortarlo',
        'Expandir con más detalles',
        'Hacerlo más formal',
        'Hacerlo más casual',
        'Mejorar el ritmo',
        'Añadir más detalles sensoriales',
        'Hacer el diálogo más natural',
        'Aumentar la tensión'
      ]
    };

    return prompts[language] || prompts.en;
  }

  /**
   * Analyze text and suggest appropriate rewrite actions
   */
  analyzeForSuggestions(text) {
    const suggestions = [];
    const wordCount = text.split(/\\s+/).length;

    // Length-based suggestions
    if (wordCount > 200) {
      suggestions.push('Consider shortening for better pacing');
    } else if (wordCount < 50) {
      suggestions.push('Could expand with more details');
    }

    // Dialogue detection
    if (text.includes('"') || text.includes("'")) {
      suggestions.push('Polish the dialogue');
    }

    // Action detection
    if (/\\b(ran|jumped|fought|grabbed|threw)\\b/i.test(text)) {
      suggestions.push('Enhance the action sequence');
    }

    return suggestions;
  }
}

// Export the service class
export default BeatRewriteService;
`;
}

// Main Worker entry point
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(env, origin);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    try {
      // Route requests
      switch (url.pathname) {
        case '/api/checkout':
          if (request.method !== 'POST') {
            return jsonResponse<ErrorResponse>(
              { error: 'Method not allowed' },
              405,
              headers
            );
          }
          return handleCheckout(request, env, headers);

        case '/api/webhook':
          if (request.method !== 'POST') {
            return jsonResponse<ErrorResponse>(
              { error: 'Method not allowed' },
              405,
              headers
            );
          }
          return handleWebhook(request, env);

        case '/api/verify':
          if (request.method !== 'GET') {
            return jsonResponse<ErrorResponse>(
              { error: 'Method not allowed' },
              405,
              headers
            );
          }
          return handleVerify(request, env, headers);

        case '/api/portal':
          if (request.method !== 'GET') {
            return jsonResponse<ErrorResponse>(
              { error: 'Method not allowed' },
              405,
              headers
            );
          }
          return handlePortal(request, env, headers);

        case '/api/prices':
          if (request.method !== 'GET') {
            return jsonResponse<ErrorResponse>(
              { error: 'Method not allowed' },
              405,
              headers
            );
          }
          return handlePrices(env, headers);

        case '/api/health':
        case '/health':
          return handleHealth(headers);

        case '/api/premium/character-chat':
          if (request.method !== 'GET') {
            return jsonResponse<ErrorResponse>(
              { error: 'Method not allowed' },
              405,
              headers
            );
          }
          return handlePremiumCharacterChat(request, env, headers);

        case '/api/premium/beat-rewrite':
          if (request.method !== 'GET') {
            return jsonResponse<ErrorResponse>(
              { error: 'Method not allowed' },
              405,
              headers
            );
          }
          return handlePremiumBeatRewrite(request, env, headers);

        default:
          return jsonResponse<ErrorResponse>(
            { error: 'Not found' },
            404,
            headers
          );
      }
    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse<ErrorResponse>(
        {
          error: error instanceof Error
            ? error.message
            : 'Internal server error',
        },
        500,
        headers
      );
    }
  },
};
