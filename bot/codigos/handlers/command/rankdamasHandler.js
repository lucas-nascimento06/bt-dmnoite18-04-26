// ============================================================
//  rankdamasHandler.js (VERSÃO COM IMAGEM NO ALERTA)
//  ✅ Handler auto-suficiente: busca metadata internamente
//  ✅ Parâmetros: apenas (client, message) — sem admList externo
//  ✅ Alerta de participação agora enviado com imagem (igual rainhaHandler)
// ============================================================

import axios from 'axios';
import { Jimp } from 'jimp';
import { getAtivos, getInativosComDias, getFantasmas, fecharDia } from '../../utils/rainhaModel.js';

const GRUPO_PRINCIPAL = '120363404775670913@g.us';
const GRUPO_ADMINS    = '120363426062597341@g.us';

// URL da imagem do poster de alerta anti-fantasmas
const FOTO_ALERTA_URL = 'https://i.ibb.co/fYV2rq3G/tropa-antifantasmas.png';

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
// 🖼️ HELPERS DE IMAGEM (igual rainhaHandler)
// ============================================
async function baixarImagem(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(res.data, 'binary');
  } catch (err) {
    console.error('❌ Erro ao baixar imagem do alerta:', err.message);
    return null;
  }
}

async function gerarThumbnail(buffer, size = 256) {
  try {
    const image = await Jimp.read(buffer);
    image.scaleToFit({ w: size, h: size });
    return await image.getBuffer("image/jpeg");
  } catch (err) {
    console.error('Erro ao gerar thumbnail:', err);
    return null;
  }
}

async function enviarComImagem(client, grupoId, buffer, legenda, mencoes) {
  try {
    const thumb = await gerarThumbnail(buffer);
    await client.sendMessage(grupoId, {
      image: buffer,
      caption: legenda,
      mentions: mencoes,
      jpegThumbnail: thumb,
    });
    return true;
  } catch {
    try {
      await client.sendMessage(grupoId, { image: buffer, caption: legenda, mentions: mencoes });
      return true;
    } catch (err2) {
      console.error('❌ Erro no fallback de imagem do alerta:', err2.message);
      return false;
    }
  }
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
          `📣 *Grupo é pra interagir.* Não é só entrar e ficar de fora.\n` +
          `Participe das conversas, nem que seja rápido, mas apareça.\n` +
          `Evite focar só no privado, a ideia é trocar ideia com todos.\n` +
          `Quem não pretende participar, deve se retirar para evitar futuras remoções.`,
      ];

       const frase = FRASES_COBRANCA[Math.floor(Math.random() * FRASES_COBRANCA.length)];
           let listaGrupo   = '';
           const mencoesGrupo = [];

      listaCobrar.forEach((m, i) => {
        // Usa sempre o número limpo do originalId para garantir que o @texto
        // bata exatamente com o JID no array mentions — isso é o que o WhatsApp
        // exige para colorir a menção de azul.
        const numParaTexto = digitos(m.originalId);
        const jidMencao   = m.originalId.includes('@') ? m.originalId : `${m.originalId}@s.whatsapp.net`;

        listaGrupo += `${i + 1}. @${numParaTexto}\n`;
        mencoesGrupo.push(jidMencao);
      });

      const legendaAlerta =
        `🚨⚠️ *🚨 Tropa Anti-Fantasmas*\n` +
        `🚨⚠️ *ALERTA DE PARTICIPAÇÃO!*\n` +
        `💡 _Interaja no grupo para não ser removido!_ 👑\n` +
        `𝝑𝝔 ⏔⏔⏔⏔⏔⏔⏔🕵️‍♂️⏔⏔⏔⏔⏔⏔⏔ 𝝑𝝔\n` +
        `${frase}\n\n` +
        `👇 *Membros que ainda não interagiram hoje:*\n\n` +
        listaGrupo.trim() +
        `\n𝝑𝝔 ⏔⏔⏔⏔⏔⏔⏔🕵️‍♀️⏔⏔⏔⏔⏔⏔⏔ 𝝑𝝔\n` +
        `💡 _Interaja no grupo para não ser removido!_ 👑`;

      // ─── Tenta enviar com imagem (igual rainhaHandler) ───
      const fotoBuffer = await baixarImagem(FOTO_ALERTA_URL);

      if (fotoBuffer) {
        const enviado = await enviarComImagem(client, grupoId, fotoBuffer, legendaAlerta, mencoesGrupo);
        if (enviado) {
          console.log(`✅ [rankdamasHandler] Alerta de cobrança com imagem enviado para ${listaCobrar.length} pessoas`);
        } else {
          // Fallback: só texto
          await client.sendMessage(grupoId, {
            text: legendaAlerta,
            mentions: mencoesGrupo,
          });
          console.log(`✅ [rankdamasHandler] Alerta de cobrança (fallback texto) enviado para ${listaCobrar.length} pessoas`);
        }
      } else {
        // Sem imagem: envia só texto
        await client.sendMessage(grupoId, {
          text: legendaAlerta,
          mentions: mencoesGrupo,
        });
        console.log(`✅ [rankdamasHandler] Alerta de cobrança (sem imagem) enviado para ${listaCobrar.length} pessoas`);
      }
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