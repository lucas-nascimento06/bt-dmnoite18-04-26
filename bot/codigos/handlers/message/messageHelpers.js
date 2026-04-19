// messageHelpers.js - FUNÇÕES AUXILIARES DO MESSAGE HANDLER
import { handleMusicaCommands } from "../musica/musicaHandler.js";
import { handleMessage as handleAdvertencias } from '../../moderation/advertenciaGrupos.js';
import { statusGrupo } from '../../moderation/removerCaracteres.js';
import { scanAndRemoveBlacklisted, onUserJoined } from "../../moderation/blacklist/blacklistFunctions.js";

/**
 * Processa comandos básicos que sempre são executados
 */
export async function handleBasicCommands(sock, message, from, userId, content, pool) {
    let handled = false;

    // Comando de música
    if (!handled) {
        handled = await handleMusicaCommands(sock, message, from);
    }
    
    // Sistema de advertências
    if (!handled) {
        await handleAdvertencias(sock, message, pool);
    }

    // Comando #status
    if (!handled && content.toLowerCase().startsWith('#status') && from.endsWith('@g.us')) {
        await statusGrupo(sock, from);
        handled = true;
    }

    // Comando inválido #da
    if (!handled && content.toLowerCase().startsWith('#da')) {
        await sock.sendMessage(from, {
            text: '❌ Comando inválido.\n✅ Exemplo: #damas music [nome da música]'
        });
    }
}

/**
 * Processa atualizações de participantes do grupo
 */
export async function handleGroupUpdate(sock, update) {
    try {
        const { id: groupId, participants, action } = update;

        console.log(`\n👥 ========= EVENTO DE GRUPO =========`);
        console.log(`📱 Grupo: ${groupId}`);
        console.log(`🎬 Ação: ${action}`);
        console.log(`👤 Participantes: ${participants.join(', ')}`);
        console.log(`=====================================\n`);

        // Bot entra no grupo - varredura automática
        if (action === 'add' && participants.includes(sock.user?.id)) {
            console.log('🤖 Bot adicionado! Iniciando varredura...');
            await scanAndRemoveBlacklisted(groupId, sock);
            return;
        }

        // Usuário entra no grupo - verifica blacklist
        if (action === 'add') {
            for (const userId of participants) {
                if (userId === sock.user?.id) continue;
                
                console.log(`🔍 Verificando ${userId} na blacklist...`);
                await onUserJoined(userId, groupId, sock);
            }

            // Atualiza AutoTag
            const { updateGroupOnJoin } = await import('./messageHandler.js');
            await updateGroupOnJoin(sock, groupId);
        }

    } catch (err) {
        console.error('❌ Erro ao processar participantes:', err);
    }
}