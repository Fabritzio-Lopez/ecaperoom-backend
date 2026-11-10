const express = require('express');
const router = express.Router();
const {
  verifyPuzzle,
  submitScore,
  getLeaderboard,
  adminLogin,
  getAdminPlayers,
  deleteAdminPlayer,
  clearAdminLeaderboard,
} = require('../controllers/escapeController');

// Rutas Públicas de Jugador
router.post('/verify-puzzle', verifyPuzzle);
router.post('/score', submitScore);
router.get('/leaderboard', getLeaderboard);

// Rutas Protegidas de Administrador
router.post('/admin/login', adminLogin);
router.get('/admin/players', getAdminPlayers);
router.delete('/admin/players/:id', deleteAdminPlayer);
router.post('/admin/clear-all', clearAdminLeaderboard);

module.exports = router;
