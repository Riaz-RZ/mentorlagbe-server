# MentorLagbe API

The MentorLagbe API is the backend service for **MentorLagbe**, a tuition and mentorship marketplace that connects students with tutors.

Built with Express.js and MongoDB, the API handles tuition listings, applications, saved tuitions, user management, role-based authorization, and Stripe payments.

This repository contains the Express.js backend. The Next.js frontend is maintained separately in the [mentorlagbe-client repository](https://github.com/Riaz-RZ/mentorlagbe-client).

## Live API

- **Backend API:** [https://mentorlagbe-server-bay.vercel.app](https://mentorlagbe-server-bay.vercel.app)
- **Health Check:** [API Health](https://mentorlagbe-server-bay.vercel.app/api/health)
- **Frontend:** [MentorLagbe Client](https://mentorlagbe-client.vercel.app)
- **Frontend Repository:** [GitHub](https://github.com/Riaz-RZ/mentorlagbe-client)

## Features

- **Tuition Management:** Create, browse, update, and manage tuition listings.
- **Application Management:** Submit applications and manage applicant statuses.
- **Saved Tuitions:** Save and manage favorite tuition opportunities.
- **Role-Based Authorization:** Separate permissions for students, tutors, and admins.
- **Admin Management:** Manage users, review statistics, and moderate tuition listings.
- **Pro Plans:** Stripe Checkout integration for one-time Pro plan purchases.
- **Payment Records:** Store verified payment information in MongoDB.
- **Webhook Verification:** Verify Stripe webhook signatures before processing payments.
- **Free-Plan Limits:** Enforce usage limits for tuition posts, applications, and saved tuitions.
- **Database Integration:** MongoDB collections for application data and Better Auth user records.

## Tech Stack

**Backend**
- Node.js
- Express 5
- JavaScript (ES Modules)
- MongoDB

**Authentication & Security**
- Better Auth
- JWT verification with `jose`
- Role-based authorization middleware
- Resource ownership verification

**Payment Integration**
- Stripe Checkout
- Stripe Webhooks

**Other Tools**
- npm
- dotenv
- Vercel

## Requirements

- Node.js and npm
- MongoDB connection string
- MentorLagbe frontend running locally or deployed
- Stripe account and API keys for payment functionality

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/Riaz-RZ/mentorlagbe-server.git
cd mentorlagbe-server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```dotenv
DB_URI=your_mongodb_connection_string
PORT=5000

CLIENT_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000

STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
```

**Environment variable descriptions:**

| Variable | Description |
| --- | --- |
| `DB_URI` | MongoDB connection string |
| `PORT` | API server port; defaults to `5000` |
| `CLIENT_URL` | Frontend origin allowed by CORS |
| `BETTER_AUTH_URL` | Frontend Better Auth URL used for JWKS retrieval |
| `STRIPE_SECRET_KEY` | Stripe secret API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |

**Important configuration notes:**

- `DB_URI` must allow the API to access the `mentorlagbe` database.
- `CLIENT_URL` must match the frontend origin exactly.
- `BETTER_AUTH_URL` should point to the frontend's Better Auth installation. If omitted, the server uses `CLIENT_URL`.
- Stripe credentials must remain private and must never be committed to Git.

### 4. Start the development server

```bash
npm run dev
```

The development command watches for file changes.

To start the server normally:

```bash
npm start
```

The API listens on port `5000` by default, or on the port specified by `PORT`.

Check the health endpoint:

[http://localhost:5000/api/health](http://localhost:5000/api/health)

## Stripe Webhook Setup

MentorLagbe uses Stripe Checkout for one-time Pro plan purchases.

The webhook is responsible for recording successful payments in MongoDB and upgrading the corresponding user's plan to `pro`.

### Payment Flow

1. An authenticated student or tutor requests a Stripe Checkout session.
2. The API creates a Checkout Session using the Stripe secret key.
3. The frontend redirects the user to Stripe-hosted checkout.
4. Stripe sends a webhook event to the backend.
5. The API verifies the webhook signature using `STRIPE_WEBHOOK_SECRET`.
6. The API processes `checkout.session.completed` events when `payment_status` is `paid`.
7. The payment is recorded in MongoDB.
8. The user's plan is upgraded to `pro`.

### Local Webhook Setup

Install and authenticate the [Stripe CLI](https://docs.stripe.com/stripe-cli).

Run:

```bash
stripe login
```

Forward Stripe events to your local API:

```bash
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Copy the signing secret (`whsec_...`) printed by the CLI and add it to your local `.env`:

```dotenv
STRIPE_WEBHOOK_SECRET=whsec_your_local_webhook_secret
```

### Production Webhook Setup

The production API is deployed on Vercel.

**Production webhook endpoint:**

```text
https://mentorlagbe-server-bay.vercel.app/api/payments/webhook
```

Configure the following in your Stripe Dashboard:

1. Open Developers → Webhooks.
2. Add a webhook endpoint using the production URL above.
3. Select the following event:

   - `checkout.session.completed`

4. Create the endpoint and reveal its signing secret.
5. Copy the production signing secret (`whsec_...`).
6. Open your backend Vercel project → Settings → Environment Variables.
7. Add `STRIPE_WEBHOOK_SECRET` with the copied value.
8. Redeploy the backend.

**Important:**
- The production signing secret is different from the local Stripe CLI signing secret.
- The webhook endpoint uses raw request-body parsing for signature verification.
- The API verifies webhook signatures before processing events.
- Duplicate webhook deliveries are handled safely using the Stripe Checkout Session ID.
- The webhook is the source of truth for payment records and Pro plan activation.
- Never expose Stripe secret keys or webhook signing secrets in frontend code.

## Authentication and Authorization

Protected API endpoints require a Better Auth JWT in the request header:

```http
Authorization: Bearer <Better-Auth-JWT>
```

The API verifies JWT signatures and expiration using the frontend's Better Auth JWKS endpoint.

Reusable middleware handles authentication and authorization:

- `verifyToken` — Verifies the user's authentication token.
- `requireRole` — Restricts access based on user roles.
- `ensureDatabase` — Ensures database availability before protected database operations.

Supported roles:

| Role | Permissions |
| --- | --- |
| Student | Browse tuitions, apply, save listings, and manage own applications |
| Tutor | Create and manage own tuition listings and review applicants |
| Admin | Manage users, moderate listings, and review platform payments |

Role and ownership checks rely on verified token claims rather than untrusted role or identity values supplied in request bodies.

## API Routes

All API responses follow this structure:

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {}
}
```

### Health

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/health` | Public |

### Tuitions

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/tuitions` | Public; approved, active listings |
| GET | `/api/tuitions/latest` | Public |
| GET | `/api/tuitions/:id` | Public |
| POST | `/api/tuitions` | Tutor or admin |
| GET | `/api/tuitions/mine` | Tutor |
| GET | `/api/tuitions/all` | Admin |
| PATCH | `/api/tuitions/:id` | Owning tutor or admin |
| PATCH | `/api/tuitions/:id/status` | Admin |
| DELETE | `/api/tuitions/:id` | Owning tutor or admin |

### Applications

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/applications` | Student |
| GET | `/api/applications/mine` | Student |
| GET | `/api/applications/tutor` | Tutor or admin |
| PATCH | `/api/applications/:id/status` | Tutor or admin; ownership checked |

### Saved Tuitions

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/saved` | Student |
| POST | `/api/saved` | Student |
| DELETE | `/api/saved` | Student |

### Users

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/api/users/stats` | Admin |
| GET | `/api/users` | Admin |

### Payments

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/payments/checkout` | Student or tutor |
| GET | `/api/payments/status?sessionId=...` | Public; read-only |
| GET | `/api/payments` | Admin |
| POST | `/api/payments/webhook` | Stripe signature verification |

## Free and Pro Plans

The API enforces usage limits for free-plan users.

| Feature | Free Plan Limit |
| --- | --- |
| Tuition posts | 2 |
| Applications | 5 |
| Saved tuitions | 5 |

Pro plan purchases are handled through Stripe Checkout. Once a verified and paid checkout event is processed, the user's plan is updated to `pro`.

## Testing

Run the Node.js built-in test suite:

```bash
npm test
```

## Deployment

The backend is deployed on **Vercel**.

Production API:

```text
https://mentorlagbe-server-bay.vercel.app
```

Configure the required environment variables in:

**Vercel → Backend Project → Settings → Environment Variables**

Ensure that:

- `DB_URI` points to the correct MongoDB database.
- `CLIENT_URL` matches the deployed frontend origin.
- `BETTER_AUTH_URL` points to the deployed frontend's Better Auth installation.
- Stripe production credentials are configured.
- `STRIPE_WEBHOOK_SECRET` matches the signing secret of the production webhook endpoint.
- CORS allows the deployed frontend origin.

Redeploy the backend after changing environment variables.

---

## Related Repository

**MentorLagbe Client:** [Next.js Frontend](https://github.com/Riaz-RZ/mentorlagbe-client)

## Author

**Md Riazul Islam**

- [GitHub](https://github.com/Riaz-RZ)
- [LinkedIn](https://www.linkedin.com/in/riazul-islam89)
