require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { sequelize } = require('./models');
const { seed } = require('./utils/seed');

// Import routes
const productsRoutes = require('./routes/products');
const containersRoutes = require('./routes/containers');
const layoutsRoutes = require('./routes/layouts');

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/products', productsRoutes);
app.use('/api/containers', containersRoutes);
app.use('/api/layouts', layoutsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Test database connection
    // await sequelize.authenticate();
    // console.log('✓ Database connected');

    // Run seeder (creates tables and sample data)
    // await seed();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n✅ Container Loading Planner API running on http://localhost:${PORT}`);
      console.log(`📖 API Docs:\n`);
      console.log(`  Products: GET/POST http://localhost:${PORT}/api/products`);
      console.log(`  Containers: GET/POST http://localhost:${PORT}/api/containers`);
      console.log(`  Layouts: GET/POST http://localhost:${PORT}/api/layouts`);
      console.log(`  Health: GET http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
