const {
  insertScore,
  getTopScores,
  cleanEmptyScores,
  deletePlayerById,
  clearAllLeaderboard,
} = require('../config/db');

// Clave y usuario maestro de Administrador
const ADMIN_USER = process.env.ADMIN_USER || 'Mari';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '19112004';
const ADMIN_SECRET_TOKEN = 'token-admin-ods8-super-secret-key-2030';

/**
 * Normaliza cadenas de texto para comparaciones
 */
const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

/**
 * 7 Estaciones y Respuestas Oficiales del Escape Room
 */
const PUZZLE_SOLUTIONS = {
  1: {
    correct: ['B'],
    explanation: '¡Correcto! El ODS 8 busca promover el crecimiento económico inclusivo y sostenible, el empleo pleno y el trabajo decente para todos.',
    badge: 'Conocedor de la Agenda 2030',
  },
  2: {
    correct: ['C'],
    explanation: '¡Excelente! El trabajo decente implica un empleo productivo con derechos, ingresos justos, seguridad social y condiciones dignas.',
    badge: 'Defensor de Derechos Laborales',
  },
  3: {
    correct: ['B'],
    explanation: '¡Exacto! La igualdad de oportunidades, la no discriminación y la protección social son pilares irremplazables del trabajo decente.',
    badge: 'Impulsor de la Equidad',
  },
  4: {
    correct: ['VERDADERO', 'V', 'TRUE'],
    explanation: '¡Correcto! La Meta 8.5 de la ONU persigue explícitamente el empleo pleno, productivo y decente para todas las personas.',
    badge: 'Estratega de la Meta 8.5',
  },
  5: {
    correct: ['FALSO', 'F', 'FALSE'],
    explanation: '¡Falso! El desempleo juvenil tiene consecuencias críticas para el desarrollo económico y perpetúa ciclos de pobreza.',
    badge: 'Vigilante del Futuro Laboral',
  },
  6: {
    correct: ['C'],
    explanation: '¡Identificación confirmada! Proyecto: "Jóvenes Creadores: Del Negocio Informal al Trabajo Digno".',
    badge: 'Miembro de Jóvenes Creadores',
  },
  7: {
    correct: ['D', '82.2', '82,2'],
    explanation: '¡Bóveda Final Desbloqueada! Según estadísticas de la OIT, la tasa de informalidad y precariedad laboral en Bolivia alcanza el 82.2%.',
    badge: 'Embajador Maestro ODS 8',
  },
};

/**
 * 1. POST /api/verify-puzzle
 */
const verifyPuzzle = async (req, res) => {
  try {
    const { level, answer } = req.body;

    if (!level || answer === undefined || answer === null) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros incompletos: se requiere "level" y "answer".',
      });
    }

    const levelNumber = parseInt(level, 10);
    const puzzle = PUZZLE_SOLUTIONS[levelNumber];

    if (!puzzle) {
      return res.status(400).json({
        success: false,
        message: `Nivel no reconocido (${level}). Los niveles válidos son del 1 al 7.`,
      });
    }

    const cleanAnswer = normalizeText(answer);
    const isCorrect = puzzle.correct.some((valid) => normalizeText(valid) === cleanAnswer);

    if (isCorrect) {
      const isFinal = levelNumber === 7;
      return res.status(200).json({
        success: true,
        level: levelNumber,
        nextLevel: isFinal ? 'victory' : levelNumber + 1,
        message: puzzle.explanation,
        badge: puzzle.badge,
      });
    }

    return res.status(400).json({
      success: false,
      level: levelNumber,
      message: 'Respuesta incorrecta. Has activado la alarma del cerrojo.',
    });
  } catch (error) {
    console.error('Error en verifyPuzzle:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al verificar el acertijo.',
      error: error.message,
    });
  }
};

/**
 * 2. POST /api/score
 * Registra tiempo, nombre, historial de respuestas y vidas
 */
const submitScore = async (req, res) => {
  try {
    const { playerName, completionTimeSeconds, answers, livesRemaining } = req.body;

    if (!playerName || typeof playerName !== 'string' || playerName.trim().length < 1) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del jugador no puede estar vacío.',
      });
    }

    if (
      completionTimeSeconds === undefined ||
      completionTimeSeconds === null ||
      isNaN(completionTimeSeconds) ||
      Number(completionTimeSeconds) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'El tiempo de finalización debe ser un número entero positivo en segundos.',
      });
    }

    const sanitizedPlayerName = playerName.trim().slice(0, 30);
    const parsedTime = Math.round(Number(completionTimeSeconds));
    const cleanLives = livesRemaining !== undefined ? Number(livesRemaining) : 3;

    const record = await insertScore(sanitizedPlayerName, parsedTime, answers || [], cleanLives);

    return res.status(201).json({
      success: true,
      message: '¡Puntaje e historial registrados exitosamente en el Leaderboard!',
      record,
    });
  } catch (error) {
    console.error('Error en submitScore:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al registrar el puntaje en la base de datos.',
      error: error.message,
    });
  }
};

/**
 * 3. GET /api/leaderboard
 */
const getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await getTopScores(10);

    return res.status(200).json({
      success: true,
      count: leaderboard ? leaderboard.length : 0,
      leaderboard: leaderboard || [],
    });
  } catch (error) {
    console.error('Error en getLeaderboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al recuperar la tabla de clasificación.',
      error: error.message,
    });
  }
};

/**
 * ==============================================================
 * CONTROLADORES DE ADMINISTRADOR (LOGIN, MONITOREO Y LIMPIEZA)
 * ==============================================================
 */

// Middleware o función auxiliar para verificar si es admin
const checkIsAdmin = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '').trim();
  return token === ADMIN_SECRET_TOKEN;
};

/**
 * POST /api/admin/login
 * Inicia sesión de Administrador
 */
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
      return res.status(200).json({
        success: true,
        message: 'Sesión de Administrador iniciada correctamente.',
        token: ADMIN_SECRET_TOKEN,
        user: { username: ADMIN_USER, role: 'admin' },
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Credenciales de Administrador incorrectas.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error en inicio de sesión.',
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/players
 * Devuelve todos los jugadores con sus respuestas completas para el panel de monitoreo
 */
const getAdminPlayers = async (req, res) => {
  try {
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Acceso denegado: Se requiere autenticación de Administrador.' });
    }

    const allPlayers = await getTopScores(100);
    return res.status(200).json({
      success: true,
      count: allPlayers.length,
      players: allPlayers,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al recuperar listado de jugadores.',
      error: error.message,
    });
  }
};

/**
 * DELETE /api/admin/players/:id
 * Elimina a un jugador individual
 */
const deleteAdminPlayer = async (req, res) => {
  try {
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Acceso denegado: Se requiere autenticación de Administrador.' });
    }

    const { id } = req.params;
    await deletePlayerById(id);

    return res.status(200).json({
      success: true,
      message: 'Jugador eliminado correctamente.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar jugador.',
      error: error.message,
    });
  }
};

/**
 * POST /api/admin/clear-all
 * Elimina todos los registros del juego
 */
const clearAdminLeaderboard = async (req, res) => {
  try {
    if (!checkIsAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Acceso denegado: Se requiere autenticación de Administrador.' });
    }

    await clearAllLeaderboard();

    return res.status(200).json({
      success: true,
      message: 'Todos los registros han sido eliminados por el Administrador.',
      players: [],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al vaciar registros.',
      error: error.message,
    });
  }
};

module.exports = {
  verifyPuzzle,
  submitScore,
  getLeaderboard,
  adminLogin,
  getAdminPlayers,
  deleteAdminPlayer,
  clearAdminLeaderboard,
};
