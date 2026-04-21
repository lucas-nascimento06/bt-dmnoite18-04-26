// messageHandler.js - VERSÃO ATUALIZADA COM MENU OWNER + RAINHA/RANKING
import AutoTagHandler from '../../moderation/autoTagHandler.js';
import ReplyTagHandler from '../../moderation/replyTagHandler.js';
import olhinhoHandler from './olhinhoHandler.js';
import confissoesHandler from './confissoesHandler.js';
import alertaHandler from '../../moderation/alertaHandler.js';
import { handleSignos } from '../../moderation/signosHandler.js';
import { handleGroupCommands } from '../../utils/redefinirFecharGrupo.js';
import { handleOwnerMenu } from '../../features/menuOwner.js';
import pool from '../../../../db.js';
import { moderacaoAvancada } from '../../moderation/removerCaracteres.js';
import { handleAntiLink } from '../../moderation/antilink.js';
import { processCommandPriorities } from '../../handlers/command/commandPriorities.js';
import { handleBasicCommands, handleGroupUpdate } from './messageHelpers.js';
import { handleStickerCommand } from '../../features/stickerHandler.js';
import { processarComandoRegras } from '../../features/boasVindas.js';
import { configurarDespedida } from '../../features/despedidaMembro.js';
import { handlePoemas, handleAtualizarPoemas } from '../command/poema.js';
import { handleReloadConfig } from '../../features/dedicatoriaHandler.js'
import { handleBanMessage } from '../../moderation/banHandler.js'; 



// ✅ NOVOS IMPORTS — rainha / ranking
import { ativosHandler, inativosHandler } from '../command/ativosHandler.js';
import { rankdamasHandler } from '../command/rankdamasHandler.js';
import { rainhaHandler } from '../command/rainhaHandler.js';
import {
  registrarMensagem,
  getInativosComDias,
  getFantasmas,
  fecharDia,
} from '../../utils/rainhaModel.js';

const autoTag = new AutoTagHandler();
const replyTag = new ReplyTagHandler();

const OWNER_NUMBERS = ['5516981874405', '5521972337640'];
const DEBUG_MODE = process.env.DEBUG === 'true';

const GRUPO_PRINCIPAL = '120363404775670913@g.us';

const MEDIA_TYPES = [
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'stickerMessage',
  'documentMessage',
  'voiceMessage',
  'ptvMessage',
  'documentWithCaptionMessage',
];

// ============================================
// 🔥 CACHE PARA EVITAR DUPLICATAS
// ============================================
const processedMessages = new Set();
const MESSAGE_CACHE_LIMIT = 200;

function cleanMessageCache() {
  if (processedMessages.size > MESSAGE_CACHE_LIMIT) {
    const toDelete = processedMessages.size - MESSAGE_CACHE_LIMIT;
    const iterator = processedMessages.values();
    for (let i = 0; i < toDelete; i++) {
      processedMessages.delete(iterator.next().value);
    }
  }
}

function getMessageUniqueId(messageKey) {
  const { remoteJid, id, fromMe, participant } = messageKey;
  return `${remoteJid}_${id}_${fromMe}_${participant || 'none'}`;
}

function resolverRemetenteReal(message) {
  const key = message.key;
  const candidatos = [key.participantAlt, key.participant];
  for (const id of candidatos) {
    if (!id) continue;
    if (id.endsWith('@g.us')) continue;
    if (id.endsWith('@lid')) continue;
    if (id.endsWith('@s.whatsapp.net')) return id;
  }
  return key.participant || null;
}

// ============================================
// 🎯 HANDLER PRINCIPAL
// ============================================
export async function handleMessages(sock, message) {
  try {
    const uniqueId = getMessageUniqueId(message.key);
    if (processedMessages.has(uniqueId)) return;

    processedMessages.add(uniqueId);
    cleanMessageCache();

    if (!message?.key || !message?.message) return;

    const from      = message.key.remoteJid;
    const userId    = message.key.participant || message.key.remoteJid;
    const messageKey = message.key;

    const messageType    = Object.keys(message.message || {})[0];
    const isMediaMessage = MEDIA_TYPES.includes(messageType);

    const content =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      message.message.imageMessage?.caption ||
      message.message.videoMessage?.caption ||
      message.message.documentWithCaptionMessage?.message?.documentMessage?.caption ||
      '';

    // ============================================
    // 🛡️ CONTROLE DE MENSAGENS DO BOT
    // ============================================
    if (message.key.fromMe) {
      const lowerContent   = content.toLowerCase().trim();
      const trimmedContent = content.trim();

      if (lowerContent.includes('#all damas')) {
        if (DEBUG_MODE) console.log('✅ Bot usando #all damas - permitido');
      } else if (
        trimmedContent.startsWith('#') ||
        trimmedContent.startsWith('!') ||
        trimmedContent.startsWith('@')
      ) {
        if (DEBUG_MODE) console.log('✅ Comando do bot - permitido');
      } else {
        if (DEBUG_MODE) console.log('⏭️ Ignorado: mensagem comum do bot');
        return;
      }
    }

    if (!content?.trim() && !isMediaMessage) return;

    if (DEBUG_MODE) {
      console.log(
        `📨 [${new Date().toLocaleTimeString()}] Tipo: ${messageType} | ` +
        `isMedia: ${isMediaMessage} | ${userId} em ${from}: ` +
        `${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`
      );
    }

    const lowerContent = content.toLowerCase().trim();

    // ============================================
    // 📝 REGISTRAR MENSAGEM (apenas no grupo principal)
    // ============================================
    if (
      from === GRUPO_PRINCIPAL &&
      !message.key.fromMe &&
      (content?.trim() || isMediaMessage)
    ) {
      const pushName = message.pushName || userId.split('@')[0];
      const rawId    = resolverRemetenteReal(message);

      if (rawId && !rawId.endsWith('@g.us')) {
        registrarMensagem(from, rawId, pushName).catch(err =>
          console.error('❌ [rainhaModel] registrarMensagem:', err.message)
        );
      }
    }

    // ============================================
    // 👑 MENU OWNER
    // ============================================
    if (lowerContent === '#dmlukownner') {
      const ownerHandled = await handleOwnerMenu(
        sock, from, userId, content, OWNER_NUMBERS, message
      );
      if (ownerHandled) {
        if (DEBUG_MODE) console.log('✅ Menu owner processado');
        return;
      }
    }

    // 💌 CONFISSÕES (privado)
    const isPrivateChat = !from.endsWith('@g.us') && !from.includes('@newsletter');
    if (isPrivateChat) {
      const handled = await confissoesHandler.handlePrivateMessage(
        sock, message, from, userId, content
      );
      if (handled) return;
    }

    // 🎵 Comando #atualizaraudios
    if (olhinhoHandler.isComandoAtualizar && olhinhoHandler.isComandoAtualizar(message)) {
      await olhinhoHandler.handleComandoAtualizar(sock, message);
      return;
    }

    // 👁️ Reações de olhinho
    const isReaction = await olhinhoHandler.handleReactionFromMessage(sock, message);
    if (isReaction) return;

    // 🛡️ Moderação em grupos
    if (from.endsWith('@g.us')) {
      await Promise.all([
        moderacaoAvancada(sock, message),
        handleAntiLink(sock, message, from),
      ]);
    }

    // 🔥 ReplyTag
    if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      const replyResult = await replyTag.processReply(
        sock, from, userId, content, messageKey, message
      );
      if (replyResult?.processed) return;
    }

    const replyAdminHandled = await replyTag.handleAdminCommands(sock, from, userId, content);
    if (replyAdminHandled) return;

    // 📋 Comando #regras
    if (lowerContent.startsWith('#regras')) {
      const regrasProcessed = await processarComandoRegras(sock, message);
      if (regrasProcessed) return;
    }

    // 📜 Poemas
    if (lowerContent === '#poema' || lowerContent === '#poemas' || lowerContent === '#poe') {
      if (DEBUG_MODE) console.log('📜 Comando #poemas detectado!');
      await handlePoemas(sock, message, [], from);
      return;
    }

    if (lowerContent === '#atualizarpoemas') {
      if (DEBUG_MODE) console.log('🔄 Comando #atualizarpoemas detectado!');
      await handleAtualizarPoemas(sock, message, [], from);
      return;
    }
      // 🎵 Atualizar config de dedicatória
    if (lowerContent === '#atualizarmusicas') {
      if (DEBUG_MODE) console.log('🔄 Comando #atualizarmusicas detectado!');
      const reloadHandled = await handleReloadConfig(sock, message, from);
      if (reloadHandled) return;
    }

    // 🚨 #alerta
    if (lowerContent === '#atualizarregras' || lowerContent.includes('#alerta')) {
      if (DEBUG_MODE) console.log(`🔍 Comando detectado: ${lowerContent}`);
      const alertaProcessed = await alertaHandler(sock, message);
      if (alertaProcessed) {
        if (DEBUG_MODE) console.log('✅ Comando processado pelo alertaHandler');
        return;
      }
    }

    // 🎨 Sticker
    if (lowerContent.startsWith('#stickerdamas')) {
      await handleStickerCommand(sock, message);
      return;
    }

    // ✅ 🚫 BANIMENTO — PRIORIDADE ALTA, ANTES DE TUDO MAIS
    if (from.endsWith('@g.us') && content?.includes('#ban')) {
      await handleBanMessage(sock, message);
      return;
    }

    // ============================================
    // 👑 COMANDOS RAINHA / RANKING
    // ============================================
    if (from.endsWith('@g.us')) {

      const _getMeta = async () => {
        const meta      = await sock.groupMetadata(from);
        const admList   = meta.participants.filter(p => p.admin).map(p => p.id);
        const adminNums = admList.map(id => id.replace(/@.*$/, ''));
        const membrosResolvidos = meta.participants
          .map(m => ({ originalId: m.id, resolvedId: m.phoneNumber ?? m.id }))
          .filter(m => m.resolvedId.endsWith('@s.whatsapp.net'));
        return { admList, adminNums, membrosResolvidos };
      };

      if (lowerContent === '#rainhadamas') {
        if (DEBUG_MODE) console.log('👑 Comando #rainhadamas detectado');
        await rainhaHandler(sock, message);
        return;
      }

      if (lowerContent === '#ativos') {
        if (DEBUG_MODE) console.log('🟢 Comando #ativos detectado');
        const { admList } = await _getMeta();
        await ativosHandler(sock, message, admList);
        return;
      }

      if (lowerContent === '#inativos') {
        if (DEBUG_MODE) console.log('🔴 Comando #inativos detectado');
        const { admList } = await _getMeta();
        await inativosHandler(sock, message, admList, GRUPO_PRINCIPAL);
        return;
      }

      if (lowerContent === '#rankdamas') {
        if (DEBUG_MODE) console.log('🏆 Comando #rankdamas detectado');

        const { admList, adminNums, membrosResolvidos } = await _getMeta();
        const rawUserId = resolverRemetenteReal(message) || userId;
        const isAdmin   = admList.includes(rawUserId);

        if (!isAdmin) {
          await sock.sendMessage(from, {
            text: '❌ Apenas administradores podem usar *#rankdamas*.',
          });
          return;
        }

        const inativosSnapshot = await getInativosComDias(from, membrosResolvidos, adminNums);
        const { fantasmas: fantasmasSnapshot } = await getFantasmas(from, membrosResolvidos, adminNums);

        const cobrarSet  = new Set(inativosSnapshot.map(m => m.resolvedId.split('@')[0]));
        const listaCobrar = [...inativosSnapshot];
        fantasmasSnapshot.forEach(f => {
          const num = f.resolvedId.split('@')[0];
          if (!cobrarSet.has(num)) listaCobrar.push(f);
        });

        await rankdamasHandler(sock, message, admList);

        try {
          if (listaCobrar.length) {
            const FRASES_COBRANCA = [
              `📣 *Se você faz parte do grupo, é importante participar.* Não adianta apenas entrar e ficar inativo.\n` +
              `Interaja, contribua e faça parte de verdade das conversas, *porque aqui não é plateia*... quem não participa acaba ficando pra trás.\n` +
              `Se perdeu o interesse, melhor ser direto. Se está sem tempo, avise um admin. Agora, ficar online só observando ou tentando puxar contato no privado não é a proposta do grupo.\n` +
              `Organize um tempo, nem que seja rápido, até no banho, apareça pra dar um oi.`,
            ];
            const frase = FRASES_COBRANCA[Math.floor(Math.random() * FRASES_COBRANCA.length)];

            let listaGrupo = '';
            const mencoesGrupo = [];
            listaCobrar.forEach((m, i) => {
              listaGrupo += `${i + 1}. @${m.resolvedId.split('@')[0]}\n`;
              mencoesGrupo.push(m.originalId);
            });

            await sock.sendMessage(from, {
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
          }
        } catch (err) {
          console.error('❌ [cobrança inativos] Erro:', err.message);
        }

        await fecharDia(from, membrosResolvidos, adminNums);
        return;
      }
    }

    // 💌 CONFISSÕES (grupo)
    if (from.endsWith('@g.us')) {
      if (lowerContent === '#avisarconfissoes') {
        const avisoPosted = await confissoesHandler.postarAvisoConfissoes(
          sock, from, userId, messageKey
        );
        if (avisoPosted) return;
      }

      if (lowerContent === '#postarconfissoes') {
        const confissaoPosted = await confissoesHandler.handleManualPost(
          sock, from, userId, messageKey
        );
        if (confissaoPosted) return;
      }
    }

    // 🔮 Signos
    const signosHandled = await handleSignos(sock, message);
    if (signosHandled) {
      if (DEBUG_MODE) console.log('✅ Comando de signos processado');
      return;
    }

    // 🔒 Comandos de grupo
    const groupCommandHandled = await handleGroupCommands(sock, message);
    if (groupCommandHandled) {
      if (DEBUG_MODE) console.log('✅ Comando de grupo processado');
      return;
    }

    // Comandos por prioridade
    const handled = await processCommandPriorities(
      sock, message, from, userId, content,
      OWNER_NUMBERS, autoTag, pool,
      { messageType, isMediaMessage }
    );

    if (!handled) {
      await handleBasicCommands(sock, message, from, userId, content, pool, {
        messageType,
        isMediaMessage,
      });
    }

  } catch (err) {
    console.error('❌ Erro ao processar mensagem:', err.message);
    if (DEBUG_MODE) console.error(err.stack);
  }
}

// ============================================
// 📌 HANDLERS AUXILIARES
// ============================================
export async function handleReactions(sock, reaction) {
  try {
    await olhinhoHandler.handleReaction(sock, reaction);
  } catch (err) {
    console.error('❌ Erro ao processar reação:', err.message);
  }
}

export async function updateGroupOnJoin(sock, groupId) {
  try {
    const count = await autoTag.updateGroup(sock, groupId);
    if (DEBUG_MODE) console.log(`✅ Grupo ${groupId}: ${count} membros`);
  } catch (error) {
    console.error('❌ Erro ao atualizar grupo:', error.message);
  }
}

export async function handleGroupParticipantsUpdate(sock, update) {
  try {
    await handleGroupUpdate(sock, update);

    if (update.action === 'remove') {
      if (DEBUG_MODE) {
        console.log(`\n👋 ========= PROCESSANDO SAÍDA/REMOÇÃO =========`);
        console.log(`🎬 Ação detectada: "${update.action}"`);
        console.log(`👮 Author (quem executou): ${update.author}`);
        console.log(`👥 Total de participantes afetados: ${update.participants.length}`);
      }

      await configurarDespedida(sock, update);

      if (DEBUG_MODE) {
        console.log(`✅ Despedida processada`);
        console.log(`==============================================\n`);
      }
    }

  } catch (err) {
    console.error('❌ Erro ao processar atualização de participantes:', err.message);
    if (DEBUG_MODE) console.error(err.stack);
  }
}

export function getCacheStats() {
  return {
    totalProcessed: processedMessages.size,
    cacheLimit: MESSAGE_CACHE_LIMIT,
    usagePercent: ((processedMessages.size / MESSAGE_CACHE_LIMIT) * 100).toFixed(1),
  };
}

export function clearMessageCache() {
  const size = processedMessages.size;
  processedMessages.clear();
  if (DEBUG_MODE) console.log(`🧹 Cache limpo: ${size} mensagens`);
}