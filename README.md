# BookHaven

BookHaven is a TypeScript MERN bookstore monorepo. The React storefront and Express API use MongoDB/Mongoose; the server owns catalog pricing, inventory, carts, orders, sessions, and payment verification.

## Requirements

- Node.js 20 or newer and npm
- Docker with Compose for local MongoDB transactions, or a MongoDB Atlas replica set
- Razorpay test credentials only when exercising online payments

## Local development

1. Install dependencies from the repository root:

   ```sh
   npm install
   ```

2. Start the MongoDB replica set:

   ```sh
   docker compose up -d mongo
   ```

3. Copy `server/.env.example` to `server/.env` and set unique, random values for both JWT secrets. Use this URI for the Compose database:

   ```text
   MONGODB_URI=mongodb://127.0.0.1:27017/bookhaven?replicaSet=rs0
   ```

   Copy `client/.env.example` to `client/.env.local` if the API is not available through the Vite proxy. The default development proxy forwards `/api` and `/uploads` to `http://localhost:5001`.

4. Run the API and Vite development server:

   ```sh
   npm run dev
   ```

5. In another terminal, seed sample categories, authors, books, and the `WELCOME10` coupon:

   ```sh
   npm run seed
   ```

6. Provision the first administrator explicitly. The command prompts for a password if the environment variable is omitted:

   ```sh
   ADMIN_BOOTSTRAP_EMAIL=admin@your-store.example npm run bootstrap:admin
   ```

   Never use a customer registration form to grant administrator access. Keep bootstrap credentials out of source control and remove them from the environment after provisioning.

The storefront is at `http://localhost:5173`, the API health endpoint is `http://localhost:5001/api/v1/health`, and Swagger UI is at `http://localhost:5001/api/docs`.

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the API and storefront concurrently |
| `npm run build` | Type-check and build both workspaces |
| `npm run lint` | Lint the API and client |
| `npm test` | Run the server and client test suites |
| `npm run seed` | Upsert the demo catalog and welcome coupon |
| `npm run bootstrap:admin` | Provision or promote the explicitly configured admin account |

The server test suite uses an in-memory MongoDB replica set so transaction-dependent tests can run without a shared database. It does not modify a developer’s MongoDB instance.

## Store and admin workflows

- Public book data is served from MongoDB through `/api/v1/books` and `/api/v1/catalog`.
- Customers can register/sign in, verify new accounts with a one-time email code, request password-reset links, keep a persistent cart and wishlist, save shipping addresses, place orders, view order history, retry pending Razorpay payments, and cancel eligible orders.
- In development without SMTP configured, email verification codes are printed in the server terminal. Configure SMTP before production so codes are delivered privately by email; production signup fails explicitly when email delivery is unavailable.
- The storefront and admin support a saved light/dark theme and accessible toast feedback for key actions such as sign-in, sign-out, cart, wishlist, and order updates.
- Checkout supports Cash on Delivery when enabled and Razorpay when server credentials are configured. Server-side order snapshots, discounts, shipping, coupon rules, and stock checks are authoritative.
- Administrators can manage books, categories, authors, order fulfillment, customer roles, coupon campaigns, review moderation, and date-filtered sales reports from the `/admin` workspace.
- Book changes and category/author visibility changes are reflected in the public storefront. Uploaded covers are served from `/uploads`; catalog mutations invalidate storefront collection queries.
- Admin APIs are protected by authentication and role middleware; frontend route protection is supplementary only.

## Razorpay test setup

Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in `server/.env` using Razorpay **test mode** values. The key secret and webhook secret must never be added to client configuration. Configure the webhook URL as:

```text
https://your-api-host/api/v1/payments/razorpay/webhook
```

Use the same webhook secret in Razorpay and the server environment. Checkout creates the Razorpay order on the server and confirms the payment signature on the server. A browser callback alone does not mark an order as paid. If payment credentials are absent, online checkout returns a configuration error; it does not simulate payment success.

## Docker Compose

Compose builds both app images from the root workspace lockfile and starts a MongoDB replica set, API, and Nginx-served client:

```sh
docker compose up --build
```

The Compose frontend is exposed at `http://localhost:5173`; the API is exposed at `http://localhost:5001` and its health endpoint at `http://localhost:5001/api/v1/health`. The Compose JWT secrets are development-only placeholders. Replace them with strong runtime secrets before exposing any service. Uploaded cover images are stored in `server/uploads`; keep that directory on persistent storage in production.

## Environment configuration

- Server variables and safe placeholders: `server/.env.example`
- Client variables: `client/.env.example`
- Transactions require MongoDB running as a replica set; a standalone local `mongod` is not sufficient.
- Email delivery is optional. Configure SMTP variables to enable mail; without SMTP, messages are logged as skipped.
- `FREE_SHIPPING_THRESHOLD`, `SHIPPING_FLAT_RATE`, `COD_ENABLED`, and `UPLOAD_MAX_MB` configure store behavior.

## API examples

All API routes are under `/api/v1`; browser sessions use secure, HTTP-only access and refresh cookies.

```sh
# Health and public catalog
curl http://localhost:5001/api/v1/health
curl 'http://localhost:5001/api/v1/books?q=habits&page=1&limit=12'

# Register a customer (the API sets HTTP-only cookies)
curl -i -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"Reader","email":"reader@example.com","password":"strong-password"}' \
  http://localhost:5001/api/v1/auth/register

# Authenticated cart
curl -b cookies.txt http://localhost:5001/api/v1/cart
```

Use Swagger UI for the complete route schemas. Never place production access tokens or credentials in example commands or source files.

## Database backup and recovery

Back up MongoDB using `mongodump` against the configured replica set and store the encrypted backup outside the application host:

```sh
mongodump --uri="$MONGODB_URI" --archive=bookhaven.archive --gzip
```

Restore only into the intended environment after validating the archive:

```sh
mongorestore --uri="$MONGODB_URI" --archive=bookhaven.archive --gzip
```

For production, use Atlas automated backups and periodically test a restore into a separate cluster. Persist uploaded images independently and include them in the backup/recovery plan.

## Deployment

Deploy the client and server as separate services and use MongoDB Atlas configured as a replica set.

1. Set production-only environment variables in the hosting provider’s secret manager. Use strong distinct JWT secrets, `NODE_ENV=production`, the public client origin, secure cookies, and Atlas credentials.
2. Set `CLIENT_URL` to the exact HTTPS storefront origin. Configure `COOKIE_SECURE=true`; use `COOKIE_SAME_SITE=none` only if the client and API are on different sites and configure CSRF protections at the edge/application accordingly.
3. Build and run the server with `npm run build -w server` and `npm run start -w server`. Expose `/api/v1/health` for readiness checks.
4. Build the client with `npm run build -w client`; serve `client/dist` from a static host/CDN or the included Nginx image. Configure `/api` and `/uploads` to reach the API when using separate domains.
5. Run the seed command only when demo content is desired. Bootstrap the first admin through the documented command, then discard bootstrap credentials.
6. Configure Razorpay test credentials in staging first; set live credentials only after payment and webhook reconciliation have been verified.

## Production security checklist

- Replace all development secrets; keep secrets only in the server/hosting secret manager.
- Use HTTPS, secure HTTP-only cookies, a strict CORS origin, and rate limits on authentication endpoints.
- Keep admin provisioning out of public registration and review administrator role changes.
- Keep MongoDB private, use least-privilege credentials, and verify backups and restore procedures.
- Restrict image uploads to allowed formats and sizes; store uploads on persistent, access-controlled storage.
- Verify Razorpay signatures/webhooks on the server; reconcile amounts and payment state before fulfillment.
- Review dependency audit output and update packages on a regular cadence.
- Monitor structured logs and alerts without logging passwords, session cookies, payment secrets, or full payment credentials.
