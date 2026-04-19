// ============================================================
//  rainhaHandler.js  →  bot/codigos/handlers/command/
//  Comando: #rainhadamas
// ============================================================

import axios from 'axios';
import { getRainhaDoDia } from '../../utils/rainhaModel.js';

const FRASES_RAINHA = [
  '👑💎 *Ela reinou, ela brilhou, ela conquistou o dia!* 💎👑\n_Ninguém mandou mais amor pra esse grupo do que ela!_',
  '✨👑 *A coroa tem dono e hoje é dela!* 👑✨\n_Cada mensagem foi um diamante jogado aqui pra gente!_',
  '💅💎 *Rainha não pede passagem — ela já chega mandando!* 💎💅\n_Hoje o grupo teve uma estrela e o nome dela está acima!_ ⭐',
  '👸🏻✨ *Quando ela fala, o grupo para pra ouvir.* ✨👸🏻\n_Hoje a coroa caiu exatamente na cabeça certa!_ 👑💎',
  '💎🌹 *Beleza, presença e muita energia — isso é a nossa Rainha do Dia!* 🌹💎\n_Que ela continue espalhando luz por aqui!_ 👑',
];

function fraseAleatoria() {
  return FRASES_RAINHA[Math.floor(Math.random() * FRASES_RAINHA.length)];
}

export async function rainhaHandler(client, message) {
  const grupoId = message.key.remoteJid;

  try {
    const rainha = await getRainhaDoDia(grupoId);

    if (!rainha) {
      return client.sendMessage(grupoId, {
        text: '👑 Ainda não há mensagens registradas hoje para eleger a Rainha do Dia!',
      });
    }

    const frase  = fraseAleatoria();
    const mencao = rainha.usuario_id;
    const legenda =
      `👑💎 *RAINHA DO DIA* 💎👑\n\n` +
      `@${mencao.split('@')[0]}\n\n` +
      `${frase}\n\n` +
      `📊 *Mensagens hoje:* ${rainha.total}`;

    // Tenta enviar com foto de perfil
    if (rainha.foto_url) {
      try {
        const response   = await axios.get(rainha.foto_url, { responseType: 'arraybuffer' });
        const fotoBuffer = Buffer.from(response.data);

        await client.sendMessage(grupoId, {
          image:    fotoBuffer,
          caption:  legenda,
          mentions: [mencao],
        });
        return;
      } catch {
        // foto falhou, cai no texto puro
      }
    }

    // Fallback: só texto com menção
    await client.sendMessage(grupoId, {
      text:     legenda,
      mentions: [mencao],
    });

  } catch (err) {
    console.error('[rainhaHandler] Erro:', err.message);
    await client.sendMessage(grupoId, {
      text: '❌ Ocorreu um erro ao buscar a Rainha do Dia. Tente novamente!',
    });
  }
}