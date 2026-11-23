# MentorLagbe API

This repository contains the Express API for MentorLagbe, a tuition and
mentorship marketplace. It provides tuition, application, saved-listing,
admin, and payment endpoints backed by MongoDB.

The frontend is maintained separately in the
[mentorlagbe-client repository](https://github.com/Riaz-RZ/mentorlagbe-client).

## Tech Stack

- Node.js with ES modules
- Express 5
- MongoDB
- Better Auth JWT verification with `jose`
- Stripe Checkout and signed webhooks

## Local Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root:

```dotenv
DB_URI=mongodb+srv://<username>:<password>@<cluster>/<database>
PORT=5000
CLIENT_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
```

`DB_URI` must allow the server to access the `mentorlagbe` database.
`CLIENT_URL` is required and is the single frontend origin allowed by CORS.
`BETTER_AUTH_URL` should point to the frontend's Better Auth installation so
the API can retrieve its JWKS; if omitted, the server uses `CLIENT_URL`.
Stripe variables are needed for checkout and webhook processing.

Start the API:

```bash
npm run dev
```

The development command watches for file changes. For a regular start, use:

```bash
npm start
```

The server listens on port `5000` by default, or on the port specified by
`PORT`. Check that it is running at
[http://localhost:5000/api/health](http://localhost:5000/api/health).

## Stripe Webhook Setup

The webhook records successful payments and activates the user's Pro plan.
`STRIPE_WEBHOOK_SECRET` must match the signing secret for the configured
webhook endpoint. Without it, payment webhook deliveries are rejected and Pro
upgrades will not complete.

For local development, install and authenticate the Stripe CLI, then run:

```bash
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Set `STRIPE_WEBHOOK_SECRET` to the `whsec_...` value printed by the CLI.
In production, configure Stripe to send `checkout.session.completed` events
to `/api/payments/webhook` on the deployed API and use that endpoint's signing
secret.

## Authentication and Authorization

Protected API routes expect:

```http
Authorization: Bearer <Better-Auth-JWT>
```

The API verifies the JWT signature and expiry using the frontend's Better Auth
JWKS endpoint. Role and ownership checks use the verified token claims, not
role or identity values supplied in the request body. Public routes include
the health check, approved tuition browsing, and payment status polling.

## API Routes

Successful and error responses use the `{ success, message, data }` envelope.

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/api/health` | Public |
| `GET` | `/api/tuitions` | Public; approved, active listings |
| `GET` | `/api/tuitions/latest` | Public |
| `GET` | `/api/tuitions/:id` | Public |
| `POST` | `/api/tuitions` | Tutor or admin |
| `GET` | `/api/tuitions/mine` | Tutor |
| `GET` | `/api/tuitions/all` | Admin |
| `PATCH` | `/api/tuitions/:id` | Owning tutor or admin |
| `PATCH` | `/api/tuitions/:id/status` | Admin |
| `DELETE` | `/api/tuitions/:id` | Owning tutor or admin |
| `POST` | `/api/applications` | Student |
| `GET` | `/api/applications/mine` | Student |
| `GET` | `/api/applications/tutor` | Tutor or admin |
| `PATCH` | `/api/applications/:id/status` | Tutor or admin; ownership checked |
| `GET`, `POST`, `DELETE` | `/api/saved` | Student |
| `GET` | `/api/users/stats` | Admin |
| `GET` | `/api/users` | Admin |
| `POST` | `/api/payments/checkout` | Student or tutor |
| `GET` | `/api/payments/status?sessionId=...` | Public; read-only |
| `GET` | `/api/payments` | Admin |
| `POST` | `/api/payments/webhook` | Stripe signature verification |

Free-plan limits are enforced by the API: two tuition posts, five applications,
and five saved tuitions. The Stripe webhook is the source of truth for payment
records and plan activation.

## Tests

Run the Node.js built-in test suite:

```bash
npm test
```
