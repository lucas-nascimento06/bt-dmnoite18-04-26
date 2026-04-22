// ============================================================
//  rankdamasHandler.js (VERSÃO CORRIGIDA — SEM DUPLICAÇÃO)
//  ✅ Handler auto-suficiente: busca metadata internamente
//  ✅ Parâmetros: apenas (client, message) — sem admList externo
// ============================================================

import { getAtivos, getInativosComDias, getFantasmas, fecharDia } from '../../utils/rainhaModel.js';

const GRUPO_PRINCIPAL = '120363404775670913@g.us';
const GRUPO_ADMINS    = '120363426062597341@g.us';

// ============================================
// 🔧 UTIL
// ============================================
function digitos(id = '') {
  return id.replace(/@.*$/, '');
}

function labelDias(dias) {
  if (dias === 1) return '1 dia sem falar';
  return `${dias} dias sem falar`;
}

// ============================================
// 🔐 ADMIN CHECK
// ============================================
async function checkIfUserIsAdmin(client, groupId, userId) {
  try {
    const groupMetadata = await client.groupMetadata(groupId);

    const participant = groupMetadata.participants.find(p => {
      const pId = p.id.includes('@') ? p.id : `${p.id}@s.whatsapp.net`;
      const uId = userId.includes('@') ? userId : `${userId}@s.whatsapp.net`;
      return pId === uId || p.id === userId || pId.split('@')[0] === uId.split('@')[0];
    });

    if (!participant) return false;
    return participant.admin === 'admin' || participant.admin === 'superadmin';
  } catch (error) {
    console.error('❌ Erro ao verificar admin:', error);
    return false;
  }
}

// ============================================
// 🗑️ DELETAR MENSAGEM
// ============================================
async function deleteCommandMessage(client, groupId, messageKey) {
  const delays = [0, 100, 500, 1000, 2000, 5000];

  for (let i = 0; i < delays.length; i++) {
    try {
      if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));

      const key = {
        remoteJid: messageKey.remoteJid || groupId,
        fromMe: false,
        id: messageKey.id,
        participant: messageKey.participant,
      };

      await client.sendMessage(groupId, { delete: key });
      console.log(`✅ Comando #rankdamas deletado (tentativa ${i + 1})`);
      return true;
    } catch {
      console.log(`❌ Tentativa ${i + 1} de deletar #rankdamas falhou`);
    }
  }
  return false;
}

// ============================================
// 🚀 HANDLER PRINCIPAL
// ✅ Apenas (client, message) — auto-suficiente
// ============================================
export async function rankdamasHandler(client, message) {
  const grupoId = message.key.remoteJid;
  const userId  = message.key.participant || message.key.remoteJid;

  console.log(`\n🎯 [rankdamasHandler] INICIADO`);
  console.log(`📱 Grupo: ${grupoId}`);
  console.log(`👤 User: ${userId}`);

  // ─── FILTRO DE GRUPO ───────────────────────
  if (grupoId !== GRUPO_PRINCIPAL) {
    console.log(`⏭️ [rankdamasHandler] Grupo não é o principal, ignorando`);
    return false;
  }

  // ─── VERIFICA ADMIN ────────────────────────
  const isAdmin = await checkIfUserIsAdmin(client, grupoId, userId);
  console.log(`🔐 [rankdamasHandler] Usuário é admin? ${isAdmin}`);

  if (!isAdmin) {
    console.log(`❌ [rankdamasHandler] Usuário não é admin, deletando...`);
    await deleteCommandMessage(client, grupoId, message.key);
    await client.sendMessage(grupoId, {
      text: '❌ Apenas *administradores* podem usar o comando *#rankdamas*!',
    });
    return true;
  }

  // ─── BUSCAR METADATA (única vez, aqui dentro) ──────────
  let membros           = [];
  let adminNums         = [];
  let membrosResolvidos = [];

  try {
    const meta = await client.groupMetadata(grupoId);
    membros = meta.participants || [];

    adminNums = membros
      .filter(m => m.admin === 'admin' || m.admin === 'superadmin')
      .map(m => digitos(m.phoneNumber ?? m.id));

    membrosResolvidos = membros.map(m => ({
      originalId: m.id,
      resolvedId: m.phoneNumber ?? m.id,
    }));

    console.log(`📊 [rankdamasHandler] ${membros.length} participantes, ${adminNums.length} admins`);
  } catch (err) {
    console.error('[rankdamasHandler] Erro ao buscar metadados:', err.message);
    await client.sendMessage(grupoId, {
      text: '❌ Erro ao buscar dados do grupo. Tente novamente!',
    });
    return true;
  }

  // ─── RANKING ───────────────────────────────
  try {
    const ativos = await getAtivos(grupoId);
    console.log(`📊 [rankdamasHandler] Ativos hoje: ${ativos.length}`);

    if (!ativos.length) {
      await client.sendMessage(grupoId, {
        text: '📭 Nenhuma mensagem registrada hoje para gerar o ranking!',
      });
      return true;
    }

    // ─── 🟢 ATIVOS ───────────────────────────
    let listaAtivos   = '';
    const mencoesAtivos = [];

    ativos.forEach((u, i) => {
      const pos    = `${i + 1}.`.padEnd(3);
      const numero = u.usuario_id;

      listaAtivos += `${pos} @${numero} — *${u.total} msgs*\n`;
      mencoesAtivos.push(`${numero}@s.whatsapp.net`);
    });

    await client.sendMessage(GRUPO_ADMINS, {
      text:
        `🟢 *RANKING DE ATIVOS DO DIA* 🟢\n` +
        `📅 ${new Date().toLocaleDateString('pt-BR')} | 👥 *${ativos.length} pessoas*\n\n` +
        `─────────────────────────\n` +
        listaAtivos.trim(),
      mentions: mencoesAtivos,
    });
    console.log(`✅ [rankdamasHandler] Ranking de ativos enviado`);

    // ─── 🔴 INATIVOS ─────────────────────────
    const inativos = await getInativosComDias(grupoId, membrosResolvidos, adminNums);

    if (inativos.length) {
      let listaInativos   = '';
      const mencoesInativos = [];

      inativos.forEach((m, i) => {
        const pos   = `${i + 1}.`.padEnd(3);
        const dias  = labelDias(m.diasInativo);
        const emoji = m.diasInativo >= 5 ? '🚫' : m.diasInativo >= 3 ? '😴' : '';
        const nome  = m.nome ? ` (${m.nome})` : '';
        const num   = digitos(m.resolvedId);

        listaInativos += `${pos} @${num}${nome} — ${dias} ${emoji}\n`;
        listaInativos += `     ➤ para remover: *#ban @${num}*\n\n`;
        mencoesInativos.push(`${num}@s.whatsapp.net`);
      });

      await client.sendMessage(GRUPO_ADMINS, {
        text:
          `🔴 *INATIVOS DO DIA* 🔴\n` +
          `📅 ${new Date().toLocaleDateString('pt-BR')} | 👥 *${inativos.length} pessoas*\n\n` +
          `─────────────────────────\n` +
          listaInativos.trim(),
        mentions: mencoesInativos,
      });
      console.log(`✅ [rankdamasHandler] Lista de inativos enviada`);
    } else {
      await client.sendMessage(GRUPO_ADMINS, {
        text: `🏆 Todos os membros interagiram hoje!`,
      });
    }

    // ─── 👻 FANTASMAS ────────────────────────
    const { fantasmas } = await getFantasmas(grupoId, membrosResolvidos, adminNums);

    if (fantasmas.length) {
      let listaFantasmas   = '';
      const mencoesFantasmas = [];

      fantasmas.forEach((m, i) => {
        const pos = `${i + 1}.`.padEnd(3);
        const num = digitos(m.resolvedId);

        listaFantasmas += `${pos} @${num}\n`;
        listaFantasmas += `     ➤ para remover: *#ban @${num}*\n\n`;
        mencoesFantasmas.push(`${num}@s.whatsapp.net`);
      });

      await client.sendMessage(GRUPO_ADMINS, {
        text:
          `👻 *FANTASMAS DO GRUPO* 👻\n` +
          `_Nunca falaram_\n` +
          `👥 *${fantasmas.length} pessoas*\n\n` +
          `─────────────────────────\n` +
          listaFantasmas.trim(),
        mentions: mencoesFantasmas,
      });
      console.log(`✅ [rankdamasHandler] Lista de fantasmas enviada`);
    }

    // ─── COBRANÇA NO GRUPO PRINCIPAL ─────────
    const cobrarSet   = new Set(inativos.map(m => m.resolvedId.split('@')[0]));
    const listaCobrar = [...inativos];

    fantasmas.forEach(f => {
      const num = f.resolvedId.split('@')[0];
      if (!cobrarSet.has(num)) listaCobrar.push(f);
    });

    if (listaCobrar.length) {
      const FRASES_COBRANCA = [
        `📣 *Se você faz parte do grupo, é importante participar.* Não adianta apenas entrar e ficar inativo.\n` +
        `Interaja, contribua e faça parte de verdade das conversas, *porque aqui não é plateia*... quem não participa acaba ficando pra trás.\n` +
        `Se perdeu o interesse, melhor ser direto. Se está sem tempo, avise um admin. Agora, ficar online só observando ou tentando puxar contato no privado não é a proposta do grupo.\n` +
        `Organize um tempo, nem que seja rápido, até no banho, apareça pra dar um oi.`,
      ];
      const frase = FRASES_COBRANCA[Math.floor(Math.random() * FRASES_COBRANCA.length)];

      let listaGrupo   = '';
      const mencoesGrupo = [];

      listaCobrar.forEach((m, i) => {
        listaGrupo += `${i + 1}. @${m.resolvedId.split('@')[0]}\n`;
        mencoesGrupo.push(m.originalId);
      });

      await client.sendMessage(grupoId, {
        text:
          `🚨⚠️ *ALERTA DE PARTICIPAÇÃO!*\n` +
          `💡 _Interaja no grupo para não ser removido!_ 👑\n` +
          `─────────────────────────\n` +
          `${frase}\n\n` +
          `👇 *Membros que ainda não interagiram hoje:*\n\n` +
          listaGrupo.trim() +
          `\n─────────────────────────\n` +
          `💡 _Interaja no grupo para não ser removido!_ 👑`,
        mentions: mencoesGrupo,
      });
      console.log(`✅ [rankdamasHandler] Alerta de cobrança enviado para ${listaCobrar.length} pessoas`);
    }

    // ─── FECHAR DIA (apenas uma vez, aqui) ───
    await fecharDia(grupoId, membrosResolvidos, adminNums);
    console.log(`✅ [rankdamasHandler] Dia fechado com sucesso!`);

  } catch (err) {
    console.error('[rankdamasHandler] Erro ao gerar ranking:', err);
    await client.sendMessage(grupoId, {
      text: '❌ Erro ao gerar o ranking.',
    });
  }

  return true;
}