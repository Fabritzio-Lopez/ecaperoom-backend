const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Almacén en memoria de respaldo (Fallback) para permitir jugar localmente si el proveedor de internet local no soporta IPv6
let fallbackLeaderboard = [
  { id: '1', player_name: 'Agente ODS-8', completion_time_seconds: 125, created_at: new Date().toISOString() },
  { id: '2', player_name: 'EcoEconomista', completion_time_seconds: 145, created_at: new Date().toISOString() },
  { id: '3', player_name: 'InnovadorSocial', completion_time_seconds: 180, created_at: new Date().toISOString() },
  { id: '4', player_name: 'GuardianLaboral', completion_time_seconds: 210, created_at: new Date().toISOString() },
  { id: '5', player_name: 'Pionero2030', completion_time_seconds: 255, created_at: new Date().toISOString() },
];

let isDbConnected = false;

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
 * Inicializa la base de datos automáticamente en el primer arranque:
 * Crea la tabla leaderboard e índices si no existen.
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
          player_name TEXT NOT NULL CHECK (char_length(trim(player_name)) >= 2 AND char_length(player_name) <= 30),
          completion_time_seconds INTEGER NOT NULL CHECK (completion_time_seconds > 0),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_leaderboard_time_asc 
        ON public.leaderboard (completion_time_seconds ASC, created_at ASC);
      `);

      const countRes = await client.query('SELECT COUNT(*) FROM public.leaderboard');
      if (parseInt(countRes.rows[0].count, 10) === 0) {
        await client.query(`
          INSERT INTO public.leaderboard (player_name, completion_time_seconds)
          VALUES 
            ('Agente ODS-8', 125),
            ('EcoEconomista', 145),
            ('InnovadorSocial', 180),
            ('GuardianLaboral', 210),
            ('Pionero2030', 255)
        `);
      }

      isDbConnected = true;
      console.log('✅ Base de datos Supabase conectada con éxito. Tabla `leaderboard` lista.');
    } finally {
      client.release();
    }
  } catch (error) {
    isDbConnected = false;
    console.warn('⚠️ Nota de conexión Supabase:', error.message);
    console.log('ℹ️ Modo Resiliente Activado: El juego funcionará al 100% con persistencia local de respaldo.');
  }
}

/**
 * Registra un puntaje en la base de datos
 */
async function insertScore(playerName, completionTimeSeconds) {
  if (pool && isDbConnected) {
    try {
      const query = `
        INSERT INTO public.leaderboard (player_name, completion_time_seconds)
        VALUES ($1, $2)
        RETURNING id, player_name, completion_time_seconds, created_at;
      `;
      const result = await pool.query(query, [playerName, completionTimeSeconds]);
      return result.rows[0];
    } catch (err) {
      console.error('Error insertando en PostgreSQL:', err.message);
    }
  }

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('leaderboard')
        .insert([{ player_name: playerName, completion_time_seconds: completionTimeSeconds }])
        .select('id, player_name, completion_time_seconds, created_at')
        .single();
      if (!error && data) return data;
    } catch (err) {
      console.error('Error insertando en Supabase REST:', err.message);
    }
  }

  // Respaldo en memoria local
  const newRecord = {
    id: 'local-' + Date.now(),
    player_name: playerName,
    completion_time_seconds: completionTimeSeconds,
    created_at: new Date().toISOString(),
  };
  fallbackLeaderboard.push(newRecord);
  return newRecord;
}

/**
 * Recupera el Top N mejores tiempos ordenados de forma ascendente
 */
async function getTopScores(limit = 10) {
  if (pool && isDbConnected) {
    try {
      const query = `
        SELECT id, player_name, completion_time_seconds, created_at
        FROM public.leaderboard
        ORDER BY completion_time_seconds ASC, created_at ASC
        LIMIT $1;
      `;
      const result = await pool.query(query, [limit]);
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
      if (!error && data) return data;
    } catch (err) {
      console.error('Error consultando Supabase REST:', err.message);
    }
  }

  // Respaldo en memoria ordenado ascendente
  return [...fallbackLeaderboard]
    .sort((a, b) => a.completion_time_seconds - b.completion_time_seconds)
    .slice(0, limit);
}

module.exports = {
  pool,
  supabaseClient,
  initializeDatabase,
  insertScore,
  getTopScores,
};
