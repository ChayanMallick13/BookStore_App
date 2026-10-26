# BookHaven — Project and Agent Handoff Guide

This document is the orientation guide for developers and coding agents working on BookHaven. It describes the current implementation, how to run it, where behavior lives, how the main data flows work, and the constraints that should be preserved when making changes.

It is based on the repository as it exists today. Source code is authoritative if this guide and implementation ever disagree. Update this document when routes, environment variables, business rules, or deployment behavior change.

## 1. Project summary

BookHaven is a full-stack online bookstore built as a TypeScript monorepo. Customers can browse a catalog, create accounts, manage a cart and wishlist, save delivery addresses, place orders, and pay using Cash on Delivery or Razorpay when configured. Administrators can manage the catalog, orders, users, coupons, review moderation, inventory records, and sales reports.

The system consists of:

- **Client:** React single-page application built with Vite, TypeScript, React Router, TanStack Query, Tailwind CSS, and a small set of reusable UI primitives.
- **API:** Express REST API in TypeScript, using MongoDB through Mongoose.
- **Database:** MongoDB configured as a replica set. Multi-document transactions are used for order and inventory workflows.
- **Images:** Uploaded book covers are written to the API's local `server/uploads/books` directory and served by the API under `/uploads`. There is no Cloudinary integration in the current implementation.
- **Payments:** Razorpay is optional and configured only on the server, apart from the publishable checkout key needed by the client. COD is enabled by default unless explicitly disabled.
- **Email:** Nodemailer with optional SMTP configuration.
- **Containerization:** Separate client and server Dockerfiles plus a Compose setup intended for local development.

The UI uses the BookHaven brand and a warm, editorial bookstore design. The storefront is responsive and includes CSS-rendered decorative cover motifs rather than emoji star glyphs.

## 2. Technology and workspace layout

### Root workspace

The root `package.json` defines npm workspaces for `client` and `server`. Install dependencies and run monorepo scripts from the repository root.

| Technology | Where it is used |
| --- | --- |
| Node.js 20+ and npm | Runtime and workspace package management |
| TypeScript | Client and server |
| React 19, React Router | Client application and routing |
| Vite 6 | Client development server and production build |
| TanStack Query | Client-side server state and caching |
| Tailwind CSS | Utility styling, with additional storefront CSS |
| Express 4 | HTTP API |
| MongoDB 7 and Mongoose 8 | Persistent data and transaction-backed workflows |
| Zod | Request and environment validation |
| Vitest | Server and client tests |
| Docker Compose | Local MongoDB replica set and app containers |
| Razorpay, Nodemailer | Optional payment and email integrations |

### Repository map

```text
.
├── package.json                 # Root npm workspace scripts
├── package-lock.json            # Locked workspace dependency tree
├── docker-compose.yml           # Local MongoDB, API, and Nginx client
├── README.md                    # This project and agent handoff guide
├── client/
│   ├── Dockerfile               # Builds static client and serves it with Nginx
│   ├── nginx.conf               # SPA fallback and API/upload reverse proxy
│   ├── package.json             # Client scripts and dependencies
│   ├── vite.config.ts           # Vite aliases, dev proxy, and host settings
│   └── src/
│       ├── App.tsx              # Routes, providers, account flows
│       ├── main.tsx             # React entry point
│       ├── pages/               # Storefront and admin route-level pages
│       ├── components/          # Shared cards, covers, layouts, UI primitives
│       ├── context/             # Authentication, theme, and toast contexts
│       ├── hooks/               # Shared client hooks
│       ├── lib/                 # API client, Razorpay helper, utilities
│       ├── styles/              # Storefront-specific stylesheet
│       ├── types/               # Shared client-side TypeScript types
│       └── test/                # Client tests and test setup
└── server/
    ├── Dockerfile               # Compiles API and creates runtime image
    ├── .env.example             # Example API configuration; not production secrets
    ├── package.json             # API scripts and dependencies
    └── src/
        ├── app.ts               # Express middleware, static uploads, routes
        ├── index.ts             # Database connection and HTTP server startup
        ├── config/              # Database, environment, Swagger configuration
        ├── controllers/         # HTTP request handlers
        ├── middleware/          # Auth, validation, uploads, error handling
        ├── models/              # Mongoose data models
        ├── routes/              # REST route definitions
        ├── scripts/             # Sample data seed and admin bootstrap
        ├── services/            # Business rules and integrations
        ├── utils/                # Errors, cookies, JWT, response, logging helpers
        ├── validators/          # Zod request schemas
        └── test/                 # API tests and database test setup
```

## 3. Application architecture

```text
Browser
  └── React/Vite client (development) or Nginx static client (container)
        ├── /api/v1/*  ───────────────► Express API
        └── /uploads/* ───────────────► Express static upload handler
                                           └── MongoDB replica set
```

- In local Vite development, `/api` and `/uploads` are proxied to `http://localhost:5001`.
- In the Docker Compose setup, Nginx serves the built client and proxies API and upload paths to the Compose service named `server` on port `5000`.
- The default client API base is the same-origin path `/api/v1`. Setting `VITE_API_URL` changes that base at **client build time**.
- The API uses `CLIENT_URL` as its credentialed CORS origin. The client sends cookies using `credentials: 'include'`.
- The API uses HTTP-only cookies named `bookhaven_access` and `bookhaven_refresh`; JavaScript in the browser should not read or store these tokens directly.
- Business rules, prices, inventory checks, coupon validation, and payment verification belong on the server. The client is not an authority for any of these values.

## 4. Client application

### Route map

The routes are configured in `client/src/App.tsx`.

| Path | Purpose |
| --- | --- |
| `/` | Store homepage |
| `/catalog` | Searchable/filterable book catalog |
| `/books/:slug` | Book detail |
| `/categories/:slug` | Category collection |
| `/authors/:slug` | Author collection |
| `/cart` | Signed-in customer's cart |
| `/checkout` | Address, coupon, order, and payment flow |
| `/orders` | Customer order history |
| `/orders/:id` | Customer order detail |
| `/wishlist` | Customer wishlist |
| `/login`, `/register` | Sign-in and registration/email verification |
| `/forgot-password`, `/reset-password` | Password recovery |
| `/about`, `/contact`, `/faq`, `/shipping-policy`, `/returns`, `/privacy`, `/terms` | Store information pages |
| `/admin` | Admin dashboard |
| `/admin/books`, `/admin/books/new`, `/admin/books/:id/edit` | Book management |
| `/admin/orders` | Order fulfillment and status management |
| `/admin/customers` | Customer and role management |
| `/admin/catalog` | Categories, authors, and coupons |
| `/admin/engagement` | Review moderation and audit-related admin interface |
| `/admin/reports` | Sales reporting |

Admin API authorization is enforced on the server. Client-side route/layout checks improve navigation and experience but are not a security boundary.

### Main client modules

- `client/src/App.tsx`: route table, application providers, sign-in/register/verification UI, and missing-page behavior.
- `client/src/lib/api.ts`: typed `fetch` wrapper. It includes credentials, parses the standard API envelope, and raises `ApiError` for non-success responses.
- `client/src/lib/razorpay.ts`: browser-side Razorpay checkout integration.
- `client/src/context/AuthContext.tsx`: current-user/session state and refresh flow.
- `client/src/context/ThemeContext.tsx`: theme selection and persistence.
- `client/src/context/ToastContext.tsx`: transient user feedback.
- `client/src/components/layout/StoreLayout.tsx`: storefront navigation, menus, announcement/footer, and page shell.
- `client/src/components/layout/AdminLayout.tsx`: administration shell.
- `client/src/components/BookCard.tsx` and `BookCover.tsx`: shared book cards and cover rendering/fallbacks.
- `client/src/styles/storefront.css`: custom storefront layout and responsive design.
- `client/src/types/index.ts`: client data contracts.

TanStack Query is configured in `App.tsx` with a 30-second query `staleTime` and one retry by default. Keep query invalidation aligned with mutations so catalog/cart/order state does not become stale.

## 5. API and server application

### Server structure and conventions

- `server/src/index.ts` validates configuration during import/startup, connects to MongoDB, creates the app, and listens on `PORT`.
- `server/src/app.ts` configures Helmet, credentialed CORS, JSON/form parsers, cookies, static uploads, Swagger UI, API routes, and the final error handler.
- Routes are mounted under `/api/v1`; route files define paths relative to their mount point.
- Zod middleware validates request bodies and query values. Keep invalid input errors explicit.
- API responses generally use `{ "success": true, "data": ..., "meta": ... }`; errors use the shared error response helper.
- Business logic belongs in services where practical. Controllers/routes should handle HTTP concerns and delegate to services.
- The API health check is `GET /api/v1/health`; Swagger UI is served at `/api/docs`.

### Route map

All API paths below are prefixed by `/api/v1`.

| Route group | Representative endpoints | Access |
| --- | --- | --- |
| Health | `GET /health` | Public |
| Authentication | `POST /auth/register`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`, `/auth/forgot-password`, `/auth/reset-password` | Public unless indicated; logout and `me` require a session |
| Books | `GET /books`, `/books/:id`, `/books/slug/:slug`; create/update/delete under `/books` | Reads public; mutations require admin |
| Public catalog | `GET /catalog/home`, `/catalog/categories`, `/catalog/categories/:slug`, `/catalog/authors`, `/catalog/authors/:slug` | Public |
| Cart | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:bookId`, `DELETE /cart` | Signed in |
| Orders | `POST /orders`, `GET /orders`, `GET /orders/:id`, `POST /orders/:id/cancel` | Signed in; an order is owner-scoped unless accessed as admin |
| Payments | `POST /payments/razorpay/order`, `/payments/razorpay/verify`; `POST /payments/razorpay/webhook` | Authenticated checkout endpoints; webhook verifies provider signature |
| User data | `GET/POST /users/addresses`, `GET/POST/DELETE /users/wishlist`, `POST /users/coupons/validate` | Signed in |
| Admin dashboard | `GET /admin/dashboard` | Admin |
| Admin books | `GET/POST /admin/books`, `GET/PATCH/DELETE /admin/books/:id` | Admin |
| Admin catalog | Category and author list/create/update under `/admin/categories` and `/admin/authors` | Admin |
| Admin orders/customers | `GET /admin/orders`, `PATCH /admin/orders/:id/status`, `GET /admin/customers`, `PATCH /admin/users/:id/role` | Admin |
| Admin engagement | `GET /admin/reviews`, `PATCH /admin/reviews/:id` | Admin |
| Admin campaigns/operations | Coupons, inventory history, CSV sales export, audit logs under `/admin` | Admin |

Consult the route files and Swagger UI for exact request/response schemas. Route implementation is split between `server/src/routes`, `controllers`, `services`, and `validators`.

### Server modules

- `server/src/routes/`: URL mapping, middleware wiring, and HTTP orchestration.
- `server/src/controllers/`: book and authentication controllers.
- `server/src/services/`: catalog, cart, order, payment, authentication, coupons, email, audit, and admin business logic.
- `server/src/models/`: MongoDB schemas and indexes.
- `server/src/middleware/auth.ts`: access-token authentication and role checks.
- `server/src/middleware/validate.ts`: Zod validation adapters.
- `server/src/middleware/upload.ts`: image file filtering, local disk storage, signature validation, and public upload paths.
- `server/src/middleware/errorHandler.ts`: maps known application, validation, and database errors to API error responses.
- `server/src/config/env.ts`: environment schema and startup validation.
- `server/src/config/db.ts`: Mongoose connection.
- `server/src/config/swagger.ts`: API documentation setup.
- `server/src/utils/`: common response, errors, pagination, JWT, cookie, logging, and route-parameter helpers.

## 6. Data model

The current Mongoose models live under `server/src/models`.

| Model | Purpose |
| --- | --- |
| `User` | Customer/admin identity, password hash, account status, email verification and password-reset state, refresh-token version |
| `Book` | Catalog item, slug/ISBN, author/category references, pricing/discount, inventory, cover paths, active/featured/archive flags |
| `Category` | Named, slugged catalog grouping with visibility flag |
| `Author` | Author profile, slug, optional bio, visibility flag |
| `Cart` | One persisted cart per user with book references and quantities |
| `Wishlist` | User's saved book references |
| `Address` | User-owned shipping address and default-address state |
| `Order` | Order totals, immutable item and shipping-address snapshots, order/payment state, idempotency data |
| `Payment` | Payment provider, amount, state, Razorpay identifiers and provider-related fields |
| `Coupon` | Discount code, percent/fixed rule, limits, expiry, usage count, active flag |
| `Review` | User/book rating and text with pending/approved/rejected moderation status |
| `InventoryTransaction` | Stock movement history, reason, reference, and stock-after value |
| `AuditLog` | Administrative action history |
| `WebhookEvent` | Idempotency and processing status for payment webhook events |

Relationships use MongoDB ObjectIds and Mongoose references. Orders deliberately snapshot product title, ISBN, price/discount, quantity, cover path, and delivery address so later catalog/address edits do not rewrite the order history.

## 7. Important business workflows

### Accounts and sessions

1. Registration validates input, creates a customer account, and starts email verification.
2. Verification uses a time-limited six-digit code. The API supports resending a code.
3. Login establishes access and refresh cookies. `/auth/me` returns the current user; refresh is used to obtain a new access session.
4. Password recovery uses the forgot/reset endpoints.
5. The authentication router has a rate limiter. Password hashes and sensitive verification/reset fields are not returned as normal user fields.
6. In development, absent SMTP configuration causes email to be logged as skipped; configure SMTP for production email delivery.

### Catalog and images

- Public book responses are filtered to visible, non-archived books by service/query logic.
- Book price and effective discounted price are calculated by server-side book logic.
- Admin book creation/update accepts up to five image files in the `covers` multipart field.
- Allowed image formats are JPEG, PNG, and WebP; file extensions, MIME types, and file signatures are checked.
- Uploads are stored locally at `server/uploads/books` and public URLs look like `/uploads/books/<filename>`.
- Persist this directory outside an ephemeral container filesystem or images can disappear during redeploy/replacement. Object storage/CDN is not currently wired in.

### Cart, order, and inventory

- Cart operations require an authenticated user. Cart quantities are bounded by model/request logic.
- Checkout submits an address ID, payment method, optional coupon, and optional idempotency key.
- The server re-reads books, prices, and stock, checks visibility/availability, computes discounts/shipping, and creates an order snapshot.
- Order creation adjusts stock, records inventory movement, updates coupon usage, and clears the cart inside a MongoDB transaction.
- A replica set is required; a standalone MongoDB server is not sufficient for transaction-dependent flows.
- Order state transitions are constrained by `ORDER_STATUS_TRANSITIONS` in `server/src/models/Order.ts`. A manually requested `paid` status is rejected unless payment has been confirmed.
- Eligible cancellations restore reserved stock. Refund state in the database is not a substitute for issuing an actual provider refund.

### Payments

- COD and Razorpay order methods are represented in order/payment models.
- Razorpay order creation and confirmation happen through authenticated server endpoints.
- The API verifies the Razorpay checkout signature; webhook requests are validated using the raw request body and configured webhook secret.
- Webhook event IDs are used for idempotency/processing tracking.
- Razorpay secrets must stay on the server. The client receives only the public key ID needed by the checkout UI.
- Without payment configuration, Razorpay checkout is unavailable; do not simulate successful payment in client code.

### Coupons, reviews, and admin

- Coupon validity and discount value are calculated by the server. Limits include active status, minimum order value, expiry, and max uses.
- Review data supports moderation states and admin review listing/approval/rejection. Do not assume public review submission exists unless a corresponding API route is added.
- Admin endpoints are protected by authentication and the `admin` role.
- Admin role changes have guardrails against self-demotion and demoting the final administrator.
- Admin actions such as role changes are written to audit logs.
- Admin reporting supports date-bounded sales metrics and CSV export.

## 8. Environment variables

Templates: `server/.env.example` and `client/.env.example`. Treat those as examples only. Do not add real credentials, private personal data, or production secrets to Git or this README.

### Server runtime

| Variable | Required/default | Description |
| --- | --- | --- |
| `NODE_ENV` | Defaults to `development` | Runtime mode; production enables secure auth cookies |
| `PORT` | Defaults to `5000` | API listen port |
| `MONGODB_URI` | Required | MongoDB URI for a replica set |
| `CLIENT_URL` | Required URL | Exact allowed browser origin for credentialed CORS |
| `JWT_ACCESS_SECRET` | Required, at least 32 characters | Access-token signing secret |
| `JWT_REFRESH_SECRET` | Required, at least 32 characters | Refresh-token signing secret; use a different random value from access secret |
| `JWT_ACCESS_EXPIRES` | `15m` | Access-token lifetime |
| `JWT_REFRESH_EXPIRES` | `7d` | Refresh-token lifetime |
| `COOKIE_SECURE` | False unless `true`; production mode forces secure cookies | Optional secure-cookie override |
| `COOKIE_SAME_SITE` | `lax` | `strict`, `lax`, or `none`; `none` requires secure cookies in modern browsers |
| `SMTP_HOST` | Optional | SMTP host; absence skips email delivery |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` / `SMTP_PASS` | Optional | SMTP authentication |
| `EMAIL_FROM` | `BookHaven <noreply@bookhaven.local>` | Sender identity; replace with a verified production sender |
| `RAZORPAY_KEY_ID` | Optional | Razorpay public key ID |
| `RAZORPAY_KEY_SECRET` | Optional | Razorpay server secret |
| `RAZORPAY_WEBHOOK_SECRET` | Optional | Secret configured for payment webhooks |
| `FREE_SHIPPING_THRESHOLD` | `999` | Subtotal threshold for free shipping |
| `SHIPPING_FLAT_RATE` | `49` | Shipping fee below free-shipping threshold |
| `COD_ENABLED` | Enabled unless set to `false` | Enables/disables COD |
| `UPLOAD_MAX_MB` | `5` | Maximum accepted image size per upload |

The admin bootstrap script also reads `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD`. These are provisioning inputs, not ordinary API runtime credentials. Prefer the password prompt rather than placing a bootstrap password in shell history or a committed file.

### Client build

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | Optional API base URL, e.g. `https://store.example/api/v1`. Defaults to `/api/v1` (same origin). Injected into the client at build time. |
| `VITE_RAZORPAY_KEY_ID` | Optional Razorpay public key ID used by checkout. Never put the Razorpay secret here. |

When serving frontend and API on separate origins, configure matching CORS and cookie settings. For cross-site cookies, use HTTPS and configure the appropriate `SameSite=None; Secure` behavior. A same-origin reverse proxy is simpler and recommended.

## 9. Local development

### Requirements

- Node.js 20 or newer and npm.
- Docker with Compose for the local MongoDB replica set, or an accessible MongoDB Atlas replica-set URI.
- Razorpay test credentials only if exercising online checkout.

### Start with Docker Compose

From the repository root:

```sh
npm install
docker compose up --build
```

Compose starts MongoDB, the API, and the Nginx-served client. The local URLs are:

- Storefront: `http://localhost:5173`
- API health: `http://localhost:5001/api/v1/health`
- Swagger UI: `http://localhost:5001/api/docs`

Compose mounts `server/uploads` into the API container so local uploaded covers survive container recreation. The Compose JWT strings are development placeholders. This setup is not production-ready and must not be exposed publicly as-is.

### Run the development servers directly

1. Install dependencies:

   ```sh
   npm install
   ```

2. Start the local replica-set database:

   ```sh
   docker compose up -d mongo
   ```

3. Copy `server/.env.example` to `server/.env`. Use the host-side Mongo URI when using Compose:

   ```dotenv
   MONGODB_URI=mongodb://127.0.0.1:27018/bookhaven?replicaSet=rs0&directConnection=true
   PORT=5001
   CLIENT_URL=http://localhost:5173
   ```

   Generate unique random values for both JWT secrets. Never reuse the checked-in development examples for a public deployment.

4. Optionally copy `client/.env.example` to `client/.env.local`. In the default local Vite setup, the Vite proxy is sufficient and `VITE_API_URL` can remain unset.

5. Start both workspaces:

   ```sh
   npm run dev
   ```

6. Optionally add demo catalog content:

   ```sh
   npm run seed
   ```

7. Provision the first administrator explicitly:

   ```sh
   ADMIN_BOOTSTRAP_EMAIL=admin@your-store.example npm run bootstrap:admin
   ```

   The bootstrap command prompts for a password if `ADMIN_BOOTSTRAP_PASSWORD` is omitted. Do not grant admin access through customer registration. Remove bootstrap inputs from runtime environments after provisioning.

The Vite dev server runs on port `5173`. `server/.env.example` uses API port `5001` for direct local development; Compose instead sets the container API to `5000` and publishes it on host port `5001`.

## 10. Build, test, and lint

Run from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run build` | Compile the API and type-check/build the client |
| `npm test` | Run server and client Vitest suites |
| `npm run lint` | Lint server and client source |
| `npm run seed` | Upsert sample catalog records and demo coupon |
| `npm run bootstrap:admin` | Create/promote the explicitly configured admin account |

Workspace-specific commands can be run with npm workspace selectors, for example:

```sh
npm run test -w server
npm run test -w client
npm run build -w server
npm run build -w client
```

Server tests use `mongodb-memory-server` with a replica set so transaction-dependent tests do not need a shared development database. Do not point tests at a production database.

## 11. Deployment guidance

### Recommended production shape

For a small first deployment, use a VPS or managed container platform for the API and client, MongoDB Atlas for the database, and a persistent volume or object storage for cover images. Put HTTPS in front of the app. A same-origin domain/reverse proxy is preferred so browser cookies work without complex cross-origin configuration.

Example topology:

```text
https://bookhaven.example
  ├── /                 → client static files
  ├── /api/*            → API container
  └── /uploads/*        → persistent upload storage/API

API container → MongoDB Atlas replica set
              → SMTP provider
              → Razorpay API (optional)
```

### Production checklist

- Use a managed MongoDB replica set or correctly configure a production replica set; configure network access and database credentials narrowly.
- Set production secrets via the hosting provider's secret manager, not in Docker images, source control, or README.
- Use separate, cryptographically random JWT access and refresh secrets of at least 32 characters.
- Set `NODE_ENV=production`, the real `CLIENT_URL`, and HTTPS-secure cookies.
- Configure SMTP and a verified sender for verification and account emails.
- Configure Razorpay live credentials and webhook URL/secret only when enabling online payments; test first in Razorpay test mode.
- Decide how uploads persist before allowing image upload. Mount durable storage at the server's uploads directory or migrate the upload adapter to object storage.
- Keep database backups and test restoring them.
- Add TLS, domain routing, health monitoring, log retention, and a deployment rollback plan.
- Run migrations/data operations deliberately; the current setup uses Mongoose models and seed scripts, not a separate migration framework.
- Create the first admin through the bootstrap script, then remove bootstrap credentials from the environment.
- Ensure the API is not exposed with development settings or placeholder secrets.

`docker-compose.yml` is a development-oriented stack: it uses placeholder JWT values, a local database container, development mode, and published local ports. Adapt it and provide production secrets/storage/network configuration before using containers in a public environment.

The client Docker image builds static assets and serves them using Nginx. Its `nginx.conf` forwards `/api/` and `/uploads/` to the Compose hostname `server:5000`; preserve or intentionally replace that routing when changing deployment topology.

`client/vite.config.ts` contains development-server configuration, including `allowedHosts: true` to support temporary development tunnels. Do not use the Vite development server as the production web server. Serve the production client build through Nginx or an equivalent static host.

## 12. Agent working agreement

When making changes in this repository:

1. Read the relevant route, page/component, service, model, validator, and tests before editing. Trace a feature across client and server when both are involved.
2. Keep TypeScript types explicit and reuse the existing API client, response helpers, error classes, validation middleware, auth middleware, and service patterns.
3. Preserve the API envelope and cookie-based authentication behavior unless the task explicitly changes them.
4. Treat the server as authoritative for prices, discounts, stock, coupon use, order state, permissions, and payment verification.
5. Use MongoDB transactions for workflows that currently depend on atomic multi-document updates. Ensure tests use replica-set-capable test setup.
6. Never log, commit, or expose passwords, tokens, signing keys, database URIs, payment secrets, SMTP credentials, private user data, or other personal information.
7. Do not place personal profiles/contact details in this public project README. Personal preferences can be provided as separate private agent instructions if needed; credentials belong in secret stores.
8. Do not weaken authorization, request validation, rate limits, upload validation, or payment-signature verification to make a test or UI flow pass.
9. Keep Vite development settings development-only. Do not set permissive production CORS or expose the Vite dev server publicly.
10. Preserve uploaded images across deploys. Do not assume container filesystems are persistent.
11. Avoid inventing storefront policies, support contact information, testimonials, reviews, or integrations that are not backed by the project or a user-provided source.
12. Make surgical changes, update directly affected tests/docs, and run the smallest relevant build/test/lint checks. Report commands run and any remaining limitation.
13. Do not commit or push unless explicitly asked.

## 13. Current limitations and things not to assume

- There is no Cloudinary/CDN provider configured. Covers currently use local disk storage and need durable storage in production.
- A tunnel hostname is for temporary development access, not permanent hosting.
- `allowedHosts: true` is Vite development configuration, not a production host allowlist or security policy.
- Email delivery requires SMTP. Without SMTP, the email service logs that the message was skipped.
- Razorpay online payment requires correctly configured server-side credentials and a webhook configuration. Missing credentials do not indicate a successful payment.
- MongoDB transaction flows require a replica set.
- Review schema and admin moderation are present; do not claim a customer review-submission UI/API unless implemented separately.
- Seed data is demonstration content, not production inventory or verified product copy.
- Informational routes exist, but policy/contact content should be reviewed and supplied by the store operator before launch.
- Production deployment requires decisions on data retention, privacy/legal text, tax, shipping, returns, customer support, monitoring, backups, and image storage. This README is technical handoff documentation, not legal or operational approval.

## 14. Useful links within the repository

- Server environment template: `server/.env.example`
- Client environment template: `client/.env.example`
- Local Compose stack: `docker-compose.yml`
- Client container and reverse proxy: `client/Dockerfile`, `client/nginx.conf`
- API container: `server/Dockerfile`
- API startup and middleware: `server/src/index.ts`, `server/src/app.ts`
- API documentation: `server/src/config/swagger.ts`; at runtime, `/api/docs`
- Admin bootstrap: `server/src/scripts/bootstrapAdmin.ts`
- Demo seed: `server/src/scripts/seed.ts`
