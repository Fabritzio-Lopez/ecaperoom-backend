const express = require('express');
const router = express.Router();
const {
  verifyPuzzle,
  submitScore,
  getLeaderboard,
  cleanupLeaderboard,
} = require('../controllers/escapeController');

// Ruta 1: POST /api/verify-puzzle -> Valida las respuestas de cada nivel
router.post('/verify-puzzle', verifyPuzzle);

// Ruta 2: POST /api/score -> Guarda el tiempo y jugador en Supabase
router.post('/score', submitScore);

// Ruta 3: GET /api/leaderboard -> Obtiene el Top 10 de mejores tiempos
router.get('/leaderboard', getLeaderboard);

// Ruta 4: POST /api/leaderboard/cleanup -> Limpia registros vacíos o pruebas
router.post('/leaderboard/cleanup', cleanupLeaderboard);

module.exports = router;
