const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// 1. Configuración de conexión directa a PostgreSQL (Recomendado para connection string)
let pool = null;
if (databaseUrl) {
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false, // Requerido para conexiones SSL a Supabase
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('error', (err) => {
    console.error('Error inesperado en el cliente del Pool de PostgreSQL:', err);
  });
}

// 2. Cliente alternativo Supabase REST SDK (@supabase/supabase-js)
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
    } else {
      console.warn('⚠️ No se ha detectado DATABASE_URL ni SUPABASE_ANON_KEY configurados.');
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

      // Semilla inicial si la tabla está vacía
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
        console.log('🌱 Datos semilla iniciales insertados en la tabla leaderboard.');
      }

      console.log('✅ Base de datos Supabase conectada con éxito. Tabla `leaderboard` lista.');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('⚠️ Advertencia al conectar con PostgreSQL Supabase:', error.message);
  }
}

/**
 * Registra un puntaje en la base de datos (PostgreSQL o Supabase SDK)
 */
async function insertScore(playerName, completionTimeSeconds) {
  if (pool) {
    const query = `
      INSERT INTO public.leaderboard (player_name, completion_time_seconds)
      VALUES ($1, $2)
      RETURNING id, player_name, completion_time_seconds, created_at;
    `;
    const result = await pool.query(query, [playerName, completionTimeSeconds]);
    return result.rows[0];
  }

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('leaderboard')
      .insert([
        {
          player_name: playerName,
          completion_time_seconds: completionTimeSeconds,
        },
      ])
      .select('id, player_name, completion_time_seconds, created_at')
      .single();

    if (error) throw error;
    return data;
  }

  throw new Error('No hay conexión activa a la base de datos (DATABASE_URL o SUPABASE_ANON_KEY no configurados).');
}

/**
 * Recupera el Top N mejores tiempos ordenados de forma ascendente
 */
async function getTopScores(limit = 10) {
  if (pool) {
    const query = `
      SELECT id, player_name, completion_time_seconds, created_at
      FROM public.leaderboard
      ORDER BY completion_time_seconds ASC, created_at ASC
      LIMIT $1;
    `;
    const result = await pool.query(query, [limit]);
    return result.rows;
  }

  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('leaderboard')
      .select('id, player_name, completion_time_seconds, created_at')
      .order('completion_time_seconds', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  throw new Error('No hay conexión activa a la base de datos.');
}

module.exports = {
  pool,
  supabaseClient,
  initializeDatabase,
  insertScore,
  getTopScores,
};
