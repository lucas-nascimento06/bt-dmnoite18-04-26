// ============================================================
//  rankdamasHandler.js  →  bot/codigos/handlers/command/
//  Comando: #rankdamas
// ============================================================

import { getAtivos, getInativosComDias, getFantasmas } from '../../utils/rainhaModel.js';

const GRUPO_PRINCIPAL = '120363404775670913@g.us';
const GRUPO_ADMINS    = '120363426062597341@g.us';

function isAdm(message, admList) {
  const sender    = message.key.participant    || message.key.remoteJid;
  const senderAlt = message.key.participantAlt || '';
  return admList.includes(sender) || admList.includes(senderAlt);
}

function labelDias(dias) {
  if (dias === 1) return '1 dia sem falar';
  return `${dias} dias sem falar`;
}

export async function rankdamasHandler(client, message, admList = []) {
  const grupoId = message.key.remoteJid;

  if (grupoId !== GRUPO_PRINCIPAL) return false;
  if (!isAdm(message, admList)) {
    await client.sendMessage(grupoId, {
      text: '❌ Apenas administradores podem usar *#rankdamas*.',
    });
    return true;
  }

  try {
    const ativos = await getAtivos(grupoId);

    if (!ativos.length) {
      await client.sendMessage(grupoId, {
        text: '📭 Nenhuma mensagem registrada hoje para gerar o ranking!',
      });
      return true;
    }

    // ─── 1. Membros do grupo ─────────────────────────────────
    const meta    = await client.groupMetadata(GRUPO_PRINCIPAL);
    const membros = meta.participants || [];

    const adminNums = membros
      .filter(m => m.admin)
      .map(m => m.id.replace(/@.*$/, ''));

    const membrosResolvidos = membros
      .map(m => ({
        originalId: m.id,
        resolvedId: m.phoneNumber ?? m.id,
      }))
      .filter(m => m.resolvedId.endsWith('@s.whatsapp.net'));

    // ─── 2. 🟢 ATIVOS → grupo admins (sem alteração) ─────────
    let listaAtivos = '';
    const mencoesAtivos = [];

    ativos.forEach((u, i) => {
      const num    = `${i + 1}.`.padEnd(3);
      const mencao = `${u.usuario_id}@s.whatsapp.net`;
      listaAtivos += `${num} @${u.usuario_id} — *${u.total} msgs*\n`;
      mencoesAtivos.push(mencao);
    });

    await client.sendMessage(GRUPO_ADMINS, {
      text:
        `🟢 *RANKING DE ATIVOS DO DIA* 🟢\n` +
        `📅 ${new Date().toLocaleDateString('pt-BR')} | 👥 *${ativos.length} pessoas*\n\n` +
        `─────────────────────────\n` +
        listaAtivos.trim(),
      mentions: mencoesAtivos,
    });

    // ─── 3. 🔴 INATIVOS → grupo admins ──────────────────────
    const inativos = await getInativosComDias(grupoId, membrosResolvidos, adminNums);

    if (inativos.length) {
      let listaInativos = '';
      const mencoesInativos = [];

      inativos.forEach((m, i) => {
        const num   = `${i + 1}.`.padEnd(3);
        const dias  = labelDias(m.diasInativo);
        const emoji = m.diasInativo >= 5 ? '🚫' : m.diasInativo >= 3 ? '😴' : '';
        const nome  = m.nome ? ` (${m.nome})` : '';
        const numLimpo = m.resolvedId.split('@')[0];

        listaInativos += `${num} @${numLimpo}${nome} — ${dias} ${emoji}\n`;
        listaInativos += `     ➤ para remover do grupo: *#ban @${numLimpo}*\n\n`;

        mencoesInativos.push(m.originalId);
      });

      await client.sendMessage(GRUPO_ADMINS, {
        text:
          `🔴 *INATIVOS DO DIA* 🔴\n` +
          `📅 ${new Date().toLocaleDateString('pt-BR')} | 👥 *${inativos.length} pessoas*\n\n` +
          `─────────────────────────\n` +
          listaInativos.trim(),
        mentions: mencoesInativos,
      });
    } else {
      await client.sendMessage(GRUPO_ADMINS, {
        text: `🏆 Incrível! Todos os membros interagiram hoje!`,
      });
    }

    // ─── 4. 👻 FANTASMAS → grupo admins ─────────────────────
    const { fantasmas } = await getFantasmas(grupoId, membrosResolvidos, adminNums);

    if (fantasmas.length) {
      let listaFantasmas = '';
      const mencoesFantasmas = [];

      fantasmas.forEach((m, i) => {
        const num      = `${i + 1}.`.padEnd(3);
        const numLimpo = m.resolvedId.split('@')[0];

        listaFantasmas += `${num} @${numLimpo}\n`;
        listaFantasmas += `     ➤ para remover do grupo: *#ban @${numLimpo}*\n\n`;

        mencoesFantasmas.push(m.originalId);
      });

      await client.sendMessage(GRUPO_ADMINS, {
        text:
          `👻 *FANTASMAS DO GRUPO* 👻\n` +
          `_Membros que nunca falaram_\n` +
          `👥 *${fantasmas.length} pessoas*\n\n` +
          `─────────────────────────\n` +
          listaFantasmas.trim(),
        mentions: mencoesFantasmas,
      });
    }

  } catch (err) {
    console.error('[rankdamasHandler] Erro:', err.message);
    await client.sendMessage(grupoId, {
      text: '❌ Erro ao gerar o ranking. Tente novamente!',
    });
  }

  return true;
}