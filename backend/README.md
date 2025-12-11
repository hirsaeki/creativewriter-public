# CreativeWriter Premium API

Cloudflare Worker backend for handling premium subscriptions via Stripe.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Stripe account](https://dashboard.stripe.com/register)

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create KV Namespace

```bash
# Create production namespace
wrangler kv:namespace create SUBSCRIPTIONS

# Create dev namespace (for local development)
wrangler kv:namespace create SUBSCRIPTIONS --preview
```

Update `wrangler.toml` with the returned namespace IDs.

### 4. Configure Stripe

1. Create a product in Stripe Dashboard:
   - Go to **Products** → **Add Product**
   - Name: "CreativeWriter Premium"
   - Add TWO prices:
     - **Monthly:** $0.99/month (recurring)
     - **Yearly:** $9.99/year (recurring) - saves ~17%
   - Note both **Price IDs** (start with `price_`)

2. Set up webhook:
   - Go to **Developers** → **Webhooks** → **Add endpoint**
   - URL: `https://creativewriter-api.<subdomain>.workers.dev/api/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
   - Note the **Webhook Secret** (starts with `whsec_`)

### 5. Set Secrets

```bash
# Set your Stripe API key (use test key for development)
wrangler secret put STRIPE_API_KEY
# Enter: sk_test_xxxxx or sk_live_xxxxx

# Set your webhook secret
wrangler secret put STRIPE_WEBHOOK_SECRET
# Enter: whsec_xxxxx

# Set your monthly price ID ($0.99/month)
wrangler secret put STRIPE_PRICE_ID_MONTHLY
# Enter: price_xxxxx

# Set your yearly price ID ($9.99/year)
wrangler secret put STRIPE_PRICE_ID_YEARLY
# Enter: price_xxxxx
```

### 6. Local Development

Create a `.dev.vars` file (gitignored):

```env
STRIPE_API_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PRICE_ID_MONTHLY=price_xxxxx
STRIPE_PRICE_ID_YEARLY=price_xxxxx
```

Run the dev server:

```bash
npm run dev
```

### 7. Deploy

```bash
npm run deploy
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/checkout` | Create checkout session |
| `POST` | `/api/webhook` | Handle Stripe webhooks |
| `GET` | `/api/verify?email=...` | Check subscription status |
| `GET` | `/api/portal?email=...` | Get customer portal URL |
| `GET` | `/api/prices` | Get available subscription prices |
| `GET` | `/api/health` | Health check |

### Request/Response Examples

#### Create Checkout

```bash
# Monthly subscription ($0.99/month)
curl -X POST https://your-worker.workers.dev/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "plan": "monthly"}'

# Yearly subscription ($9.99/year - saves 17%)
curl -X POST https://your-worker.workers.dev/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "plan": "yearly"}'
```

Response:
```json
{"url": "https://checkout.stripe.com/..."}
```

#### Get Prices

```bash
curl https://your-worker.workers.dev/api/prices
```

Response:
```json
{
  "monthly": {"priceId": "price_xxx", "amount": 99, "currency": "usd"},
  "yearly": {"priceId": "price_xxx", "amount": 999, "currency": "usd"}
}
```

#### Verify Subscription

```bash
curl https://your-worker.workers.dev/api/verify?email=user@example.com
```

Response:
```json
{
  "active": true,
  "status": "active",
  "expiresAt": 1735689600000,
  "cancelAtPeriodEnd": false,
  "plan": "yearly"
}
```

## Testing Webhooks Locally

Use Stripe CLI to forward webhooks:

```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Forward webhooks to local dev server
stripe listen --forward-to http://localhost:8787/api/webhook

# Copy the webhook signing secret and add to .dev.vars
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `STRIPE_API_KEY` | Stripe secret key | Yes (secret) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | Yes (secret) |
| `STRIPE_PRICE_ID_MONTHLY` | Price ID for monthly subscription ($0.99) | Yes (secret) |
| `STRIPE_PRICE_ID_YEARLY` | Price ID for yearly subscription ($9.99) | Yes (secret) |
| `ALLOWED_ORIGINS` | CORS allowed origins | Yes |
| `SUCCESS_URL` | Redirect after successful checkout | Yes |
| `CANCEL_URL` | Redirect after cancelled checkout | Yes |

## Troubleshooting

### Webhook signature verification failed

- Ensure you're using `constructEventAsync` (not `constructEvent`)
- Check that the webhook secret matches
- Verify the raw request body isn't modified

### CORS errors

- Add your domain to `ALLOWED_ORIGINS` in `wrangler.toml`
- Ensure the origin header is sent with requests

### KV errors

- Verify the namespace ID in `wrangler.toml`
- Check you've created both production and preview namespaces
