const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Almacén en memoria de respaldo limpio (sin datos simulados vacíos)
let fallbackLeaderboard = [];
let isDbConnected = false;

// Nombres de prueba / placeholder que se limpian automáticamente
const DUMMY_NAMES = [
  'Agente ODS-8',
  'EcoEconomista',
  'InnovadorSocial',
  'GuardianLaboral',
  'Pionero2030',
];

// 1. Configuración de conexión directa a PostgreSQL
let pool = null;
if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 6000,
  });

  pool.on('error', (err) => {
    console.error('Error en pool de PostgreSQL:', err.message);
  });
}

// 2. Cliente alternativo Supabase REST SDK
let supabaseClient = null;
if (supabaseUrl && supabaseAnonKey) {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Limpia registros vacíos, nulos o de prueba de la base de datos
 */
async function cleanEmptyScores() {
  // Limpieza en PostgreSQL
  if (pool) {
    try {
      const query = `
        DELETE FROM public.leaderboard
        WHERE player_name IS NULL
           OR trim(player_name) = ''
           OR player_name = 'undefined'
           OR player_name = 'null'
           OR player_name = ANY($1)
           OR completion_time_seconds IS NULL
           OR completion_time_seconds <= 0;
      `;
      const res = await pool.query(query, [DUMMY_NAMES]);
      console.log(`🧹 Registros vacíos o de prueba eliminados en PostgreSQL: ${res.rowCount || 0}`);
    } catch (err) {
      console.warn('Advertencia en limpieza PostgreSQL:', err.message);
    }
  }

  // Limpieza en memoria local
  const prevCount = fallbackLeaderboard.length;
  fallbackLeaderboard = fallbackLeaderboard.filter(
    (item) =>
      item &&
      item.player_name &&
      item.player_name.trim().length > 0 &&
      item.player_name !== 'undefined' &&
      item.player_name !== 'null' &&
      !DUMMY_NAMES.includes(item.player_name.trim()) &&
      Number(item.completion_time_seconds) > 0
  );
  const cleaned = prevCount - fallbackLeaderboard.length;
  if (cleaned > 0) {
    console.log(`🧹 Registros vacíos o de prueba eliminados en memoria: ${cleaned}`);
  }
}

/**
 * Inicializa la base de datos y ejecuta la limpieza de vacíos
 */
async function initializeDatabase() {
  if (!pool) {
    if (supabaseClient) {
      console.log('ℹ️ Usando cliente SDK Supabase REST API.');
    }
    return;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.leaderboard (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          player_name TEXT NOT NULL CHECK (char_length(trim(player_name)) >= 1 AND char_length(player_name) <= 30),
          completion_time_seconds INTEGER NOT NULL CHECK (completion_time_seconds > 0),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_leaderboard_time_asc 
        ON public.leaderboard (completion_time_seconds ASC, created_at ASC);
      `);

      isDbConnected = true;
      console.log('✅ Base de datos Supabase conectada con éxito.');

      // Ejecutar limpieza automática al arrancar
      await cleanEmptyScores();
    } finally {
      client.release();
    }
  } catch (error) {
    isDbConnected = false;
    console.warn('⚠️ Nota de conexión Supabase:', error.message);
    console.log('ℹ️ Modo Resiliente Activado con memoria limpia.');
  }
}

/**
 * Registra un puntaje válido en la base de datos
 */
async function insertScore(playerName, completionTimeSeconds) {
  const sanitized = (playerName || '').toString().trim().slice(0, 30);
  const time = Math.round(Number(completionTimeSeconds));

  if (!sanitized || time <= 0) {
    throw new Error('Datos inválidos: el nombre no puede estar vacío y el tiempo debe ser mayor a 0.');
  }

  if (pool && isDbConnected) {
    try {
      const query = `
        INSERT INTO public.leaderboard (player_name, completion_time_seconds)
        VALUES ($1, $2)
        RETURNING id, player_name, completion_time_seconds, created_at;
      `;
      const result = await pool.query(query, [sanitized, time]);
      return result.rows[0];
    } catch (err) {
      console.error('Error insertando en PostgreSQL:', err.message);
    }
  }

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('leaderboard')
        .insert([{ player_name: sanitized, completion_time_seconds: time }])
        .select('id, player_name, completion_time_seconds, created_at')
        .single();
      if (!error && data) return data;
    } catch (err) {
      console.error('Error insertando en Supabase REST:', err.message);
    }
  }

  // Respaldo en memoria local (solo registros con nombre válido)
  const newRecord = {
    id: 'local-' + Date.now(),
    player_name: sanitized,
    completion_time_seconds: time,
    created_at: new Date().toISOString(),
  };
  fallbackLeaderboard.push(newRecord);
  return newRecord;
}

/**
 * Recupera solo resultados válidos (excluyendo vacíos, nulos y pruebas)
 */
async function getTopScores(limit = 10) {
  if (pool && isDbConnected) {
    try {
      const query = `
        SELECT id, player_name, completion_time_seconds, created_at
        FROM public.leaderboard
        WHERE player_name IS NOT NULL
          AND trim(player_name) != ''
          AND player_name != 'undefined'
          AND player_name != 'null'
          AND player_name != ALL($2)
          AND completion_time_seconds > 0
        ORDER BY completion_time_seconds ASC, created_at ASC
        LIMIT $1;
      `;
      const result = await pool.query(query, [limit, DUMMY_NAMES]);
      return result.rows;
    } catch (err) {
      console.error('Error consultando PostgreSQL:', err.message);
    }
  }

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('leaderboard')
        .select('id, player_name, completion_time_seconds, created_at')
        .order('completion_time_seconds', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(limit);

      if (!error && data) {
        return data.filter(
          (item) =>
            item &&
            item.player_name &&
            item.player_name.trim().length > 0 &&
            !DUMMY_NAMES.includes(item.player_name.trim()) &&
            Number(item.completion_time_seconds) > 0
        );
      }
    } catch (err) {
      console.error('Error consultando Supabase REST:', err.message);
    }
  }

  // Respaldo en memoria limpio
  return [...fallbackLeaderboard]
    .filter(
      (item) =>
        item &&
        item.player_name &&
        item.player_name.trim().length > 0 &&
        !DUMMY_NAMES.includes(item.player_name.trim()) &&
        Number(item.completion_time_seconds) > 0
    )
    .sort((a, b) => a.completion_time_seconds - b.completion_time_seconds)
    .slice(0, limit);
}

module.exports = {
  pool,
  supabaseClient,
  initializeDatabase,
  cleanEmptyScores,
  insertScore,
  getTopScores,
};
