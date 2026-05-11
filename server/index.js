require('dotenv').config();
const express    = require('express');
const fileUpload = require('express-fileupload');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const fs         = require('fs');
const schedulerWorker = require('./services/scheduler');

const sectionsRouter   = require('./routes/sections');
const recipientsRouter = require('./routes/recipients');
const sendRouter       = require('./routes/send');
const logsRouter       = require('./routes/logs');
const templatesRouter  = require('./routes/templates');
const statsRouter      = require('./routes/stats');
const schedulerRouter  = require('./routes/scheduler');
const { router: authRouter } = require('./routes/auth');
const requireAuth      = require('./middleware/requireAuth');

const app  = express();
const PORT = process.env.PORT || 3001;

// CORS — restrict to own origin in production
const allowedOrigin = process.env.ALLOWED_ORIGIN || `http://localhost:${PORT}`;
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? allowedOrigin : true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(fileUpload({
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB max per file
  abortOnLimit: true,
  useTempFiles: true,
  tempFileDir: require('os').tmpdir(),
}));

// Rate limit login — max 20 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});
app.use('/api/auth/login', loginLimiter);

// Public routes (no auth needed)
app.use('/api/auth', authRouter);
app.get('/api/ping', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Protected API routes
app.use('/api/sections',   requireAuth, sectionsRouter);
app.use('/api/recipients', requireAuth, recipientsRouter);
app.use('/api/send',       requireAuth, sendRouter);
app.use('/api/logs',       requireAuth, logsRouter);
app.use('/api/templates',  requireAuth, templatesRouter);
app.use('/api/stats',      requireAuth, statsRouter);
app.use('/api/scheduler',  requireAuth, schedulerRouter);

// Serve React build
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const indexHtml  = path.join(clientDist, 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error('[WARN] client/dist/index.html not found — run npm run build first');
}
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(503).send('UI not built. Check build logs.');
  }
});

const server = app.listen(PORT, () => {
  console.log(`Aurora Mailer server running on http://localhost:${PORT}`);
  schedulerWorker.start();
});

// Graceful shutdown on SIGTERM (Render sends this before stopping the container)
process.on('SIGTERM', () => {
  console.log('[Shutdown] SIGTERM received — closing HTTP server gracefully');
  server.close(() => {
    console.log('[Shutdown] HTTP server closed');
    process.exit(0);
  });
  // Force exit after 30s if connections don't drain
  setTimeout(() => process.exit(1), 30_000);
});

module.exports = app;
