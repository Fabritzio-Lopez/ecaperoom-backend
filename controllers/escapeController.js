const { insertScore, getTopScores } = require('../config/db');

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
 * 1. POST /api/verify-puzzle
 * Valida de forma segura desde el backend las respuestas de cada acertijo del Escape Room.
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

    switch (levelNumber) {
      case 1: {
        // Nivel 1 (Cerrojo Numérico): 42
        // Meta ODS 8.1 (Crecimiento del 7% anual en países menos adelantados) * 6 ejes de acción laboral
        const cleanAnswer = normalizeText(answer);
        if (cleanAnswer === '42') {
          return res.status(200).json({
            success: true,
            level: 1,
            nextLevel: 2,
            message:
              '¡Cerrojo 1 desbloqueado! Crecimiento económico sostenible (7%) multiplicado por los 6 ejes estratégicos de empleo = 42.',
            badge: 'Pionero de la Productividad',
          });
        }
        return res.status(400).json({
          success: false,
          level: 1,
          message:
            'Combinación incorrecta. Pista: Multiplica la tasa de crecimiento objetivo de la Meta 8.1 por los 6 pilares de la OIT.',
        });
      }

      case 2: {
        // Nivel 2 (Cerrojo de Palabra): EMPRESAS
        // Actores clave en la generación de empleo digno y valor económico
        const cleanAnswer = normalizeText(answer);
        if (cleanAnswer === 'EMPRESAS') {
          return res.status(200).json({
            success: true,
            level: 2,
            nextLevel: 3,
            message:
              '¡Cerrojo 2 abierto! Las EMPRESAS y MIPYMES son el motor central para crear trabajo formal, inclusivo y productivo.',
            badge: 'Impulsor del Ecosistema Laboral',
          });
        }
        return res.status(400).json({
          success: false,
          level: 2,
          message:
            'Palabra clave incorrecta. Pista: Sector de 8 letras que genera más del 70% del empleo formal a nivel global.',
        });
      }

      case 3: {
        // Nivel 3 (Cerrojo de Suma): 10
        // Sinergia de ODS conectados: 4 (Educación) + 5 (Igualdad de género) + 1 (Fin de la pobreza) = 10
        const cleanAnswer = normalizeText(answer);
        if (cleanAnswer === '10') {
          return res.status(200).json({
            success: true,
            level: 3,
            nextLevel: 'victory',
            message:
              '¡Cerrojo 3 superado! Sinergia de ODS conectados: 4 (Educación) + 5 (Igualdad de Género) + 1 (Fin de la Pobreza) = 10. ¡Has liberado el potencial económico!',
            badge: 'Embajador ODS 8',
          });
        }
        return res.status(400).json({
          success: false,
          level: 3,
          message:
            'Suma incorrecta. Pista: Suma los números de los 3 ODS señalados en los monitores de soporte.',
        });
      }

      default:
        return res.status(400).json({
          success: false,
          message: 'Nivel no reconocido. Los niveles válidos son 1, 2 y 3.',
        });
    }
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

    // Validaciones de entrada
    if (!playerName || typeof playerName !== 'string' || playerName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del jugador debe tener al menos 2 caracteres.',
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

    // Inserción en Supabase (vía PostgreSQL Pool o Supabase Client)
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
 * Retorna los 10 mejores tiempos ordenados de forma ascendente.
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

module.exports = {
  verifyPuzzle,
  submitScore,
  getLeaderboard,
};
