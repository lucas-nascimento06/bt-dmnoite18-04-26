// db.js
import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

// Cria pool global para Neon/Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // necessário para Neon
});

// Testa conexão ao iniciar
pool.connect()
  .then(() => console.log("💾 Conectado ao Neon DB!"))
  .catch(err => console.error("❌ Erro ao conectar ao Neon DB:", err));

export default pool;
