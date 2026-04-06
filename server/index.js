require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const path = require('path');
const fs   = require('fs');
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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  abortOnLimit: true,
  useTempFiles: false,
}));

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

app.listen(PORT, () => {
  console.log(`Aurora Mailer server running on http://localhost:${PORT}`);
  schedulerWorker.start();
});

module.exports = app;
