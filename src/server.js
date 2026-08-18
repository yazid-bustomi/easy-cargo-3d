require('dotenv').config();
require('express-async-errors');

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { sequelize } = require('./models');

// Import routes
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const containersRoutes = require('./routes/containers');
const layoutsRoutes = require('./routes/layouts');
const projectsRoutes = require('./routes/projects');

const app = express();

// ── Middleware ───────────────────────────────────────────────────────
// Helmet with relaxed CSP for 3D app (WebGL, inline styles, etc.)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS: izinkan semua origin di production (karena frontend & backend
// di-serve dari server yang sama, CORS tidak diperlukan).
// Di development, React dev server (port 3000) memanggil backend (port 5000).
app.use(cors({
  origin: true,  // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ── Health check ────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ──────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/containers', containersRoutes);
app.use('/api/layouts', layoutsRoutes);
app.use('/api/projects', projectsRoutes);

// ── Serve React Frontend (production build) ─────────────────────────
// Setelah `npm run build` di folder frontend/, hasilnya ada di frontend/build/.
// Server ini akan meng-serve file-file statis tersebut.
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'build');
app.use(express.static(frontendBuildPath));

// Semua route yang BUKAN /api/* dan bukan file statis → serve index.html
// Ini diperlukan supaya React Router (client-side routing) berfungsi.
app.get('*', (req, res, next) => {
  // Jangan intercept /api routes
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendBuildPath, 'index.html'), (err) => {
    if (err) {
      // Jika build belum ada, return 404 biasa
      res.status(404).json({
        success: false,
        error: 'Frontend build not found. Run: cd frontend && npm run build',
      });
    }
  });
});

// ── Error handlers ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
  });
});

// ── Start ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected');

    await sequelize.sync({ alter: false });
    console.log('✓ Database synced');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✅ Easy Cargo 3D running on http://localhost:${PORT}`);
      console.log(`   API:      http://localhost:${PORT}/api`);
      console.log(`   Frontend: http://localhost:${PORT}/`);
      console.log(`   Health:   http://localhost:${PORT}/health\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
