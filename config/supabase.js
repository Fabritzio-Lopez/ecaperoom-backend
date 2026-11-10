const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ ADVERTENCIA: SUPABASE_URL o SUPABASE_ANON_KEY no están definidas en las variables de entorno. Las consultas a la base de datos fallarán hasta configurarlas.'
  );
}

// Instancia única del cliente de Supabase
const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

module.exports = supabase;
