const { insertScore, getTopScores, cleanEmptyScores } = require('../config/db');

/**
 * Normaliza cadenas de texto para comparaciones tolerantes a mayúsculas, espacios y acentos.
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
 * Definición oficial de las 7 estaciones del Escape Room ODS 8
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
    explanation: '¡Correcto! La Meta 8.5 de la ONU persigue explícitamente el empleo pleno, productivo y decente para todas las mujeres y hombres, incluidos los jóvenes y las personas con discapacidad.',
    badge: 'Estratega de la Meta 8.5',
  },
  5: {
    correct: ['FALSO', 'F', 'FALSE'],
    explanation: '¡Falso! El desempleo juvenil tiene consecuencias críticas: frena la innovación, perpetúa ciclos de pobreza y debilita el crecimiento económico de un país.',
    badge: 'Vigilante del Futuro Laboral',
  },
  6: {
    correct: ['C'],
    explanation: '¡Identificación confirmada! Proyecto: "Jóvenes Creadores: Del Negocio Informal al Trabajo Digno", impulsando la formalización y el talento juvenil.',
    badge: 'Miembro de Jóvenes Creadores',
  },
  7: {
    correct: ['D', '82.2', '82,2'],
    explanation: '¡Bóveda Final Desbloqueada! Según estadísticas de la OIT y análisis laborales, la informalidad y precariedad laboral en Bolivia alcanza el 82.2%, evidenciando la urgencia de proyectos de formalización digna.',
    badge: 'Embajador Maestro ODS 8',
  },
};

/**
 * 1. POST /api/verify-puzzle
 * Valida de forma segura desde el backend las respuestas de los 7 acertijos del Escape Room.
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
 * Registra el tiempo y apodo del jugador en la base de datos de Supabase.
 */
const submitScore = async (req, res) => {
  try {
    const { playerName, completionTimeSeconds } = req.body;

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

    const record = await insertScore(sanitizedPlayerName, parsedTime);

    return res.status(201).json({
      success: true,
      message: '¡Puntaje registrado exitosamente en el Leaderboard!',
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
 * Retorna los mejores tiempos ordenados de forma ascendente.
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
 * 4. POST /api/leaderboard/cleanup
 * Limpia y purga todos los registros vacíos o de prueba.
 */
const cleanupLeaderboard = async (req, res) => {
  try {
    await cleanEmptyScores();
    const cleanList = await getTopScores(10);

    return res.status(200).json({
      success: true,
      message: 'Limpieza completada. Los registros vacíos han sido eliminados.',
      count: cleanList.length,
      leaderboard: cleanList,
    });
  } catch (error) {
    console.error('Error en cleanupLeaderboard:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al limpiar los registros.',
      error: error.message,
    });
  }
};

module.exports = {
  verifyPuzzle,
  submitScore,
  getLeaderboard,
  cleanupLeaderboard,
};
