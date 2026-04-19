import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Teste de conexão
pool.connect((err, client, release) => {
  if (err) {
    console.error('Erro ao conectar com o banco:', err.stack);
  } else {
    console.log('✅ Conectado ao banco Neon com sucesso!');
    release();
  }
});

export const query = (text, params) => pool.query(text, params);
export { pool };