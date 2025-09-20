import '../scripts/ensureSingleServer.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cloneRouter from './routes/clone.js';
import stripeRouter from './routes/stripe.js';
import path from 'path';
import compression from 'compression';
import morgan from 'morgan';
import { randomUUID } from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fromRoot = ( ...p ) => path.resolve(process.cwd(), ...p);

const app = express();
const PORT = process.env.PORT || 5020;

// Global process error handlers
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));

// Request ID
app.use((req, _res, next) => {
  req.id = randomUUID();
  next();
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173',
    'https://clonementorpro-8cmb2x3zj-ttpro-live.vercel.app',
    'https://clonementorpro.vercel.app',
    'https://*.vercel.app'
  ],
  credentials: true
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/clone', cloneRouter);
app.use('/api/stripe', stripeRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'CloneMentorPro', ts: Date.now() }));

// Error handling middleware
app.use((err, req, res, _next) => {
  const status = err?.status || err?.statusCode || 500;
  const traceId = req?.id || randomUUID();
  const code = typeof err?.code === 'string' ? err.code : status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST';
  console.error('[ERR]', traceId, err);
  res.status(status).json({
    ok: false,
    code,
    traceId,
    message: err?.message || 'Server error',
    stack: process.env.NODE_ENV !== 'production' ? String(err?.stack || '') : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`CloneMentor Pro Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
