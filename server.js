const express = require('express');
const cors = require('cors');
require('dotenv').config();

const escapeRoutes = require('./routes/escape');
const { initializeDatabase } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Configuración de Middlewares
app.use(
  cors({
    origin: CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());

// Endpoint de verificación de estado (Healthcheck)
app.get('/', (req, res) => {
  res.json({
    service: 'API Escape Room ODS 8 - Trabajo Decente y Crecimiento Económico',
    status: 'ONLINE',
    version: '1.1.0',
    database: process.env.DATABASE_URL ? 'PostgreSQL Supabase (Direct Wire Pool)' : 'Supabase REST API',
    endpoints: {
      health: 'GET /api/health',
      verifyPuzzle: 'POST /api/verify-puzzle',
      submitScore: 'POST /api/score',
      leaderboard: 'GET /api/leaderboard',
      adminLogin: 'POST /api/admin/login',
      adminPlayers: 'GET /api/admin/players',
      adminClear: 'POST /api/admin/clear-all',
    },
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
  });
});

// Enrutador de la API
app.use('/api', escapeRoutes);

// Manejador de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// Manejador global de errores (500)
app.use((err, req, res, next) => {
  console.error('Error no controlado en el servidor:', err);
  res.status(500).json({
    success: false,
    message: 'Ocurrió un error inesperado en el servidor.',
    error: process.env.NODE_ENV === 'production' ? null : err.message,
  });
});

// Inicio del servidor con inicialización de base de datos
app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`🚀 Servidor Escape Room ODS 8 ejecutándose`);
  console.log(`📡 Puerto: ${PORT}`);
  console.log(`🌐 URL Base: http://localhost:${PORT}`);
  console.log(`🔒 Origen CORS permitido: ${CORS_ORIGIN}`);
  console.log(`=======================================================`);

  // Inicializar y verificar tabla en PostgreSQL Supabase
  await initializeDatabase();
});
