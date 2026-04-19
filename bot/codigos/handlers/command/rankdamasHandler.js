// ============================================================
//  rankdamasHandler.js  →  bot/codigos/handlers/command/
//  Comando: #rankdamas
// ============================================================

import axios from 'axios';
import Jimp from 'jimp';
import { getAtivos, getRainhaDoDia, getInativosComDias, getFantasmas } from '../../utils/rainhaModel.js';

const GRUPO_PRINCIPAL = '120363404775670913@g.us';
const GRUPO_ADMINS    = '120363426062597341@g.us';

const NOME_GRUPO  = '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸';
const FOTO_URL    = 'https://i.ibb.co/XrWL1ZnG/damas-neon.jpg';

// ✅ Igual ao despedidaMembro.js
async function baixarImagemRainha() {
  try {
    console.log('🖼️ Baixando imagem da rainha...');
    const res = await axios.get(FOTO_URL, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(res.data, 'binary');
    console.log(`✅ Imagem da rainha baixada: ${buffer.length} bytes`);
    return buffer;
  } catch (error) {
    console.error('❌ Erro ao baixar imagem da rainha:', error.message);
    return null;
  }
}

// ✅ Igual ao musicaHandler.js — gera thumbnail para forçar preview
async function gerarThumbnail(buffer, size = 256) {
  try {
    const image = await Jimp.read(buffer);
    image.scaleToFit(size, size);
    return await image.getBufferAsync(Jimp.MIME_JPEG);
  } catch (err) {
    console.error('Erro ao gerar thumbnail:', err);
    return null;
  }
}

// ✅ Igual ao musicaHandler.js — envia imagem com thumbnail (força aparecer)
async function sendMediaWithThumbnail(sock, jid, buffer, caption, mentions = []) {
  try {
    const thumb = await gerarThumbnail(buffer, 256);
    await sock.sendMessage(jid, {
      image: buffer,
      caption,
      mentions,
      jpegThumbnail: thumb
    });
    console.log('✅ Imagem enviada com thumbnail!');
    return true;
  } catch (err) {
    console.error('❌ Erro ao enviar com thumbnail:', err.message);
    // Fallback sem thumbnail
    try {
      await sock.sendMessage(jid, { image: buffer, caption, mentions });
      console.log('✅ Imagem enviada sem thumbnail (fallback)!');
      return true;
    } catch (err2) {
      console.error('❌ Erro no fallback:', err2.message);
      return false;
    }
  }
}

function isAdm(message, admList) {
  const sender    = message.key.participant    || message.key.remoteJid;
  const senderAlt = message.key.participantAlt || '';
  return admList.includes(sender) || admList.includes(senderAlt);
}

const FRASES_RAINHA = [
  '👑✨ *Hoje tivemos alguém que simplesmente brilhou no grupo!* ✨👑\n_Com uma presença leve, divertida e cheia de energia boa, conquistou o destaque do dia!_ 💎\n_A gente agradece demais por fazer parte desse espaço e deixar tudo mais especial!_ 💖',
  '💎👑 *A coroa de hoje tem dono(a), e com muito merecimento!* 👑💎\n_Cada mensagem, cada interação, tudo contribuiu pra deixar o grupo mais animado e acolhedor._ ✨\n_Muito obrigado por participar e espalhar essa vibe incrível que todo mundo gosta!_ 💫',
  '🌟👑 *O destaque de hoje não poderia ser diferente!* 👑🌟\n_Com participação constante, bom humor e uma energia contagiante, chegou ao topo!_ 💬\n_Gratidão por fazer parte do grupo e ajudar a manter esse clima tão leve e especial!_ 💖',
  '👑💬 *Teve alguém que realmente fez a diferença hoje!* 💬👑\n_Com mensagens que animaram geral e presença marcante, deixou o grupo ainda mais vivo._ ✨\n_A gente valoriza demais quem soma assim, obrigado por estar com a gente!_ 🌟',
  '💖👑 *Energia boa, participação ativa e aquele toque especial!* 👑💖\n_Hoje o destaque vai pra quem chegou chegando e fez o grupo brilhar ainda mais._ 🌟\n_É muito bom ter gente assim por aqui, obrigado por contribuir com essa vibe incrível!_ 💫',
  '👑🔥 *Hoje foi dia de reconhecer quem fez acontecer!* 🔥👑\n_Com presença forte e mensagens que levantaram o astral, ganhou o topo com estilo._ 💬\n_Valeu demais por fortalecer o grupo e manter essa energia lá em cima!_ 💥',
  '🌈👑 *Tem gente que transforma o grupo, e hoje foi essa pessoa!* 👑🌈\n_Com leveza, alegria e participação constante, fez o dia ser melhor pra todo mundo._ ✨\n_Obrigado por estar aqui e fazer parte dessa vibe tão boa!_ 💖',
  '👑💫 *Hoje o brilho foi diferente, e teve dono(a)!* 💫👑\n_Cada mensagem trouxe mais vida pro grupo e deixou tudo mais animado._ 💬\n_A gente só tem a agradecer por essa presença que faz tanta diferença!_ 🌟',
  '💎👑 *O destaque de hoje é mais que merecido!* 👑💎\n_Com atitude, presença e energia positiva, conquistou geral sem esforço._ ✨\n_Muito obrigado por somar com o grupo e manter esse clima incrível!_ 💖',
  '👑🎉 *Hoje alguém roubou a cena do melhor jeito!* 🎉👑\n_Com participação ativa e mensagens que deram vida ao grupo, chegou ao topo._ 💬\n_É muito bom ter gente assim aqui, obrigado por fazer parte!_ 💫',
  '🌟👑 *Tem dias que alguém se destaca, hoje foi impossível não notar!* 👑🌟\n_Com energia boa e presença constante, fez o grupo ficar ainda mais especial._ ✨\n_Agradecemos demais por contribuir com essa vibe incrível!_ 💖',
  '👑💖 *Hoje o destaque vem com carinho e reconhecimento!* 💖👑\n_Com mensagens leves e participação marcante, fez toda diferença._ 💬\n_Obrigado por estar com a gente e ajudar a construir esse espaço tão bom!_ 🌟',
  '🔥👑 *Quando a pessoa chega chegando, não tem como passar batido!* 👑🔥\n_Hoje alguém dominou o grupo com presença e muita energia boa._ 💥\n_Valeu demais por animar geral e fazer o grupo acontecer!_ 💫',
  '👑✨ *Hoje foi dia de celebrar quem fez o grupo brilhar!* ✨👑\n_Com cada mensagem, trouxe mais vida e alegria pra conversa._ 💬\n_Obrigado por participar e espalhar essa energia tão positiva!_ 💖',
  '💬👑 *Presença marcante, energia boa e participação de verdade!* 👑💬\n_Hoje o destaque vai pra quem realmente fez o grupo acontecer._ 🌟\n_A gente valoriza demais isso, obrigado por estar aqui!_ 💫',
  '👑🌟 *O topo de hoje tem dono(a), e com razão!* 🌟👑\n_Com mensagens que animaram e presença constante, fez a diferença._ 💬\n_Gratidão por fortalecer o grupo com essa vibe incrível!_ 💖',
  '💖👑 *Hoje o grupo ficou ainda melhor por causa de alguém!* 👑💖\n_Com leveza e participação ativa, trouxe mais alegria pra todos._ ✨\n_Muito obrigado por fazer parte e contribuir com essa energia boa!_ 💫',
  '👑💎 *Destaque do dia conquistado com estilo!* 💎👑\n_Com presença e interação, deixou o grupo mais vivo e animado._ 💬\n_É muito bom ter você aqui, obrigado por somar!_ 🌟',
  '🌟👑 *Hoje teve alguém que elevou o nível do grupo!* 👑🌟\n_Com mensagens cheias de energia e participação constante, brilhou demais._ ✨\n_Obrigado por trazer essa vibe que todo mundo gosta!_ 💖',
  '👑🎊 *Encerrando o dia com reconhecimento merecido!* 🎊👑\n_Alguém fez a diferença com presença, energia e muita interação._ 💬\n_A gente agradece de verdade por fazer parte e fortalecer o grupo!_ 💫'
];

function fraseAleatoria() {
  return FRASES_RAINHA[Math.floor(Math.random() * FRASES_RAINHA.length)];
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
    const rainha = await getRainhaDoDia(grupoId);
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

    // ─── 2. 👑 RAINHA DO DIA → grupo principal ───────────────
    if (rainha) {
      const mencao  = `${rainha.usuario_id}@s.whatsapp.net`;
      const caption =
        `${NOME_GRUPO}\n\n` +
        `👑💎 *RAINHA DO DIA* 💎👑\n\n` +
        `@${rainha.usuario_id}\n\n` +
        `${fraseAleatoria()}\n\n` +
        `📊 *Mensagens hoje:* ${rainha.total}`;

      const fotoBuffer = await baixarImagemRainha();

      if (fotoBuffer) {
        // ✅ Usa sendMediaWithThumbnail igual ao musicaHandler
        const enviado = await sendMediaWithThumbnail(
          client,
          GRUPO_PRINCIPAL,
          fotoBuffer,
          caption,
          [mencao]
        );
        if (!enviado) {
          // Fallback texto se tudo falhar
          await client.sendMessage(GRUPO_PRINCIPAL, { text: caption, mentions: [mencao] });
        }
      } else {
        console.log('⚠️ Imagem indisponível, enviando só texto...');
        await client.sendMessage(GRUPO_PRINCIPAL, { text: caption, mentions: [mencao] });
      }
    }

    // ─── 3. 🟢 ATIVOS → grupo admins ────────────────────────
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

    // ─── 4. 🔴 INATIVOS → grupo admins ──────────────────────
    const inativos = await getInativosComDias(grupoId, membrosResolvidos, adminNums);

    if (inativos.length) {
      let listaInativos = '';
      const mencoesInativos = [];

      inativos.forEach((m, i) => {
        const num   = `${i + 1}.`.padEnd(3);
        const dias  = labelDias(m.diasInativo);
        const emoji = m.diasInativo >= 5 ? '🚫' : m.diasInativo >= 3 ? '😴' : '';

        listaInativos += `${num} @${m.resolvedId.split('@')[0]} — ${dias} ${emoji}\n`;

        if (m.diasInativo >= 5) {
          listaInativos += `     ⚠️ *BAN SUGERIDO →* #ban @${m.resolvedId.split('@')[0]}\n`;
        }

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

    // ─── 5. 👻 FANTASMAS → grupo admins ─────────────────────
    const { fantasmas, conectadoEm } = await getFantasmas(grupoId, membrosResolvidos, adminNums);

    if (fantasmas.length) {
      let listaFantasmas = '';
      const mencoesFantasmas = [];

      fantasmas.forEach((m, i) => {
        const num = `${i + 1}.`.padEnd(3);
        listaFantasmas += `${num} @${m.resolvedId.split('@')[0]}\n`;
        mencoesFantasmas.push(m.originalId);
      });

      await client.sendMessage(GRUPO_ADMINS, {
        text:
          `👻 *FANTASMAS DO GRUPO* 👻\n` +
          `_Nunca falaram desde ${conectadoEm}_\n` +
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