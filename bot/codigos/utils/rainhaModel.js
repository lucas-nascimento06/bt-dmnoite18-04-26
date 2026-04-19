// ============================================================
//  rainhaModel.js  →  bot/codigos/data/rainhaModel.js
// ============================================================

import pool from '../../../db.js';

// ============================================
// 🤖 NÚMERO DO BOT (nunca aparece em inativos)
// ============================================
const BOT_NUMBER = '5511997869449';

// ============================================
// 🔧 UTILITÁRIO
// ============================================
function extrairNumeroLimpo(rawId) {
  if (!rawId) return null;
  const semSufixo     = rawId.replace(/@.*$/, '');
  const apenasDigitos = semSufixo.replace(/\D/g, '');
  if (apenasDigitos.length < 10) return null;
  return apenasDigitos;
}

function dataHojeBrasilia() {
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const [d, m, a] = hoje.split('/');
  return `${a}-${m}-${d}`;
}

// ============================================
// 🗄️ INIT DB
// ============================================
export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mensagens_grupo (
      id           SERIAL PRIMARY KEY,
      grupo_id     TEXT NOT NULL,
      usuario_id   TEXT NOT NULL,
      nome         TEXT NOT NULL,
      foto_url     TEXT,
      quantidade   INTEGER DEFAULT 0,
      dias_inativo INTEGER DEFAULT 0,
      ultimo_ativo DATE,
      data         DATE NOT NULL DEFAULT CURRENT_DATE,
      criado_em    TIMESTAMP DEFAULT NOW(),
      UNIQUE (grupo_id, usuario_id)
    );
    CREATE INDEX IF NOT EXISTS idx_mg_grupo
      ON mensagens_grupo (grupo_id);

    CREATE TABLE IF NOT EXISTS bot_conexao (
      grupo_id     TEXT PRIMARY KEY,
      conectado_em DATE NOT NULL DEFAULT CURRENT_DATE
    );
  `);
  console.log('🗄️ Tabelas verificadas/criadas.');
}

// ============================================
// 📅 REGISTRAR CONEXÃO DO BOT NO GRUPO
// ============================================
export async function registrarConexaoBot(grupoId) {
  const hoje = dataHojeBrasilia();
  await pool.query(
    `INSERT INTO bot_conexao (grupo_id, conectado_em)
     VALUES ($1, $2)
     ON CONFLICT (grupo_id) DO UPDATE SET conectado_em = $2`,
    [grupoId, hoje]
  );
}

// ============================================
// 📝 REGISTRAR MENSAGEM
// ============================================
export async function registrarMensagem(grupoId, usuarioId, nome, fotoUrl = null) {
  const numeroLimpo = extrairNumeroLimpo(usuarioId);
  if (!numeroLimpo) {
    console.warn(`⚠️ [rainhaModel] Número inválido ignorado: ${usuarioId}`);
    return;
  }

  const hoje = dataHojeBrasilia();
  await pool.query(
    `INSERT INTO mensagens_grupo
       (grupo_id, usuario_id, nome, foto_url, quantidade, dias_inativo, ultimo_ativo, data)
     VALUES ($1, $2, $3, $4, 1, 0, $5, $5)
     ON CONFLICT (grupo_id, usuario_id)
     DO UPDATE SET
       quantidade   = mensagens_grupo.quantidade + 1,
       nome         = EXCLUDED.nome,
       foto_url     = COALESCE(EXCLUDED.foto_url, mensagens_grupo.foto_url),
       dias_inativo = 0,
       ultimo_ativo = $5,
       data         = $5`,
    [grupoId, numeroLimpo, nome, fotoUrl, hoje]
  );
}

// ============================================
// 👑 RAINHA DO DIA
// ============================================
export async function getRainhaDoDia(grupoId) {
  const hoje = dataHojeBrasilia();
  const res = await pool.query(
    `SELECT usuario_id, nome, foto_url, quantidade AS total
       FROM mensagens_grupo
      WHERE grupo_id = $1
        AND data = $2
        AND quantidade > 0
      ORDER BY total DESC
      LIMIT 1`,
    [grupoId, hoje]
  );
  return res.rows[0] || null;
}

// ============================================
// 📊 ATIVOS DO DIA
// ============================================
export async function getAtivos(grupoId) {
  const hoje = dataHojeBrasilia();
  const res = await pool.query(
    `SELECT usuario_id, nome, quantidade AS total
       FROM mensagens_grupo
      WHERE grupo_id = $1
        AND data = $2
        AND quantidade > 0
      ORDER BY total DESC`,
    [grupoId, hoje]
  );
  return res.rows;
}

// ============================================
// 👻 FANTASMAS (nunca falaram desde conexão do bot)
// ============================================
export async function getFantasmas(grupoId, membrosResolvidos, adminNums = []) {
  const res = await pool.query(
    `SELECT usuario_id FROM mensagens_grupo WHERE grupo_id = $1`,
    [grupoId]
  );
  const conhecidos = new Set(res.rows.map(r => r.usuario_id));

  const conn = await pool.query(
    `SELECT conectado_em FROM bot_conexao WHERE grupo_id = $1`,
    [grupoId]
  );
  const conectadoEm = conn.rows[0]?.conectado_em
    ? new Date(conn.rows[0].conectado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : 'início';

  const ignorados = new Set([BOT_NUMBER, ...adminNums]);

  const fantasmas = membrosResolvidos.filter(m => {
    const num = m.resolvedId.replace(/@.*$/, '');
    return !conhecidos.has(num) && !ignorados.has(num);
  });

  return { fantasmas, conectadoEm };
}

// ============================================
// 😴 INATIVOS COM DIAS ACUMULADOS
// ============================================
export async function getInativosComDias(grupoId, membrosResolvidos, adminNums = []) {
  const res = await pool.query(
    `SELECT usuario_id, dias_inativo
       FROM mensagens_grupo
      WHERE grupo_id = $1`,
    [grupoId]
  );

  const bancoPorNumero = {};
  res.rows.forEach(r => { bancoPorNumero[r.usuario_id] = r.dias_inativo; });

  const ativosHoje = new Set(
    (await getAtivos(grupoId)).map(u => u.usuario_id)
  );

  const ignorados = new Set([BOT_NUMBER, ...adminNums]);

  return membrosResolvidos
    .filter(m => {
      const num = m.resolvedId.replace(/@.*$/, '');
      return !ativosHoje.has(num) && !ignorados.has(num) && num in bancoPorNumero;
    })
    .map(m => {
      const num         = m.resolvedId.replace(/@.*$/, '');
      const diasInativo = bancoPorNumero[num] + 1;
      return { ...m, diasInativo };
    })
    .sort((a, b) => b.diasInativo - a.diasInativo);
}

// ============================================
// 🔄 FECHAR DIA
// ============================================
export async function fecharDia(grupoId, membrosResolvidos, adminNums = []) {
  const hoje = dataHojeBrasilia();

  // ✅ CORREÇÃO: monta o conjunto de números que ainda estão no grupo
  // e remove do banco qualquer registro de quem já saiu
  const numerosNoGrupo = new Set(
    membrosResolvidos.map(m => m.resolvedId.replace(/@.*$/, ''))
  );

  const todosNoBanco = await pool.query(
    `SELECT usuario_id FROM mensagens_grupo WHERE grupo_id = $1`,
    [grupoId]
  );

  const sairamDoGrupo = todosNoBanco.rows
    .map(r => r.usuario_id)
    .filter(num => !numerosNoGrupo.has(num));

  if (sairamDoGrupo.length) {
    await pool.query(
      `DELETE FROM mensagens_grupo
        WHERE grupo_id = $1
          AND usuario_id = ANY($2)`,
      [grupoId, sairamDoGrupo]
    );
    console.log(`🚪 [rainhaModel] ${sairamDoGrupo.length} membro(s) removido(s) do banco por ter saído do grupo.`);
  }

  const ativosHoje = new Set(
    (await getAtivos(grupoId)).map(u => u.usuario_id)
  );

  const ignorados = new Set([BOT_NUMBER, ...adminNums]);

  // Incrementa dias_inativo APENAS de quem o bot já conhece e não falou hoje
  const inativosNums = membrosResolvidos
    .map(m => m.resolvedId.replace(/@.*$/, ''))
    .filter(num => !ativosHoje.has(num) && !ignorados.has(num));

  if (inativosNums.length) {
    await pool.query(
      `UPDATE mensagens_grupo
          SET dias_inativo = dias_inativo + 1
        WHERE grupo_id = $1
          AND usuario_id = ANY($2)`,
      [grupoId, inativosNums]
    );
  }

  // Zera dias_inativo de quem falou hoje
  const ativosArray = [...ativosHoje];
  if (ativosArray.length) {
    await pool.query(
      `UPDATE mensagens_grupo
          SET dias_inativo = 0
        WHERE grupo_id = $1
          AND usuario_id = ANY($2)`,
      [grupoId, ativosArray]
    );
  }

  // Zera quantidade de quem falou hoje
  await pool.query(
    `UPDATE mensagens_grupo
        SET quantidade = 0
      WHERE grupo_id = $1
        AND data = $2
        AND quantidade > 0`,
    [grupoId, hoje]
  );

  // Remove banidos (5+ dias inativos)
  await pool.query(
    `DELETE FROM mensagens_grupo
      WHERE grupo_id = $1
        AND dias_inativo >= 5`,
    [grupoId]
  );

  console.log(`🔄 [rainhaModel] Dia fechado para grupo ${grupoId}`);
}