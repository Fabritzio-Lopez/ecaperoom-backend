const express = require('express');
const router = express.Router();
const {
  verifyPuzzle,
  submitScore,
  getLeaderboard,
} = require('../controllers/escapeController');

// Ruta 1: POST /api/verify-puzzle -> Valida las respuestas de cada nivel
router.post('/verify-puzzle', verifyPuzzle);

// Ruta 2: POST /api/score -> Guarda el tiempo y jugador en Supabase
router.post('/score', submitScore);

// Ruta 3: GET /api/leaderboard -> Obtiene el Top 10 de mejores tiempos
router.get('/leaderboard', getLeaderboard);

module.exports = router;
