
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import * as paymentService from './services/paymentService.js';
import { sendError, sendSuccess } from './utils/apiResponse.js';

export function createApp() {
  const app = express();

  // Trust the reverse proxy in front of the Render service.
  // This must be set before rate-limiter middleware runs.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );

  // Razorpay webhook: preserve the raw body for signature verification.
  app.post(
    '/api/v1/payments/razorpay/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res, next) => {
      try {
        const signature = req.headers['x-razorpay-signature'];
        const eventId = req.headers['x-razorpay-event-id'];

        if (
          typeof signature !== 'string' ||
          typeof eventId !== 'string' ||
          !eventId.trim() ||
          !Buffer.isBuffer(req.body)
        ) {
          return sendError(res, 'Invalid webhook', 400);
        }

        if (
          !paymentService.verifyWebhookSignature(
            req.body,
            signature,
          )
        ) {
          return sendError(res, 'Invalid signature', 401);
        }

        const payload = JSON.parse(
          req.body.toString('utf8'),
        ) as Record<string, unknown>;

        const result = await paymentService.processWebhookEvent(
          eventId,
          payload,
        );

        return sendSuccess(res, result);
      } catch (error) {
        return next(error);
      }
    },
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use('/uploads', express.static(path.resolve('uploads')));

  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec),
  );

  app.use('/api/v1', routes);

  app.use(errorHandler);

  return app;
}
