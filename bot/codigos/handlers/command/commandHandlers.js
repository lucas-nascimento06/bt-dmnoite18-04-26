// commandHandlers.js - HANDLERS INDIVIDUAIS DE COMANDOS
import { handleSignos } from '../../moderation/signosHandler.js';
import { handleBlacklistCommands } from '../../../codigos/moderation/blacklist/blacklistHandler.js';
import { listarSignos, handleHoroscopoCommand } from '../../features/horoscopoHandler.js';
import { scanAndRemoveBlacklisted } from '../../../codigos/moderation/blacklist/blacklistFunctions.js';

/**
 * Função para deletar mensagem com múltiplas tentativas (IGUAL AO #BAN)
 */
const deleteCommandMessage = async (sock, groupId, messageKey) => {
    const delays = [0, 100, 500, 1000, 2000, 5000];
    
    for (let i = 0; i < delays.length; i++) {
        try {
            if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
            
            const key = {
                remoteJid: messageKey.remoteJid || groupId,
                fromMe: false,
                id: messageKey.id,
                participant: messageKey.participant
            };
            
            await sock.sendMessage(groupId, { delete: key });
            console.log(`✅ Comando deletado (tentativa ${i + 1})`);
            return true;
        } catch (error) {
            console.log(`❌ Tentativa ${i + 1} de deletar comando falhou`);
        }
    }
    return false;
};

// 🔮 SIGNOS
export async function handleSignosCommands(sock, message, content, from) {
    const lowerContent = content.toLowerCase().trim();
    
    const comandos = [
        '#damastaro', '#atualizarsignos', '!listasignos', '!listarsignos',
        '!mysignos', '!signos', '!signo ', '!signoaleatorio', '!signo aleatorio',
        '!horoscopo', '!horoscopocompleto', '!atualizarhoroscopo', '!ajudahoroscopo'
    ];

    if (comandos.some(cmd => lowerContent.startsWith(cmd))) {
        await handleSignos(sock, message);
        console.log(`🔮 Signos: ${lowerContent.split(' ')[0]}`);
        return true;
    }
    return false;
}

// 🚫 BLACKLIST - CORRIGIDO
export async function handleBlacklistGroup(sock, from, userId, content, message) {
    // Passa a mensagem completa (message) ao invés de pool
    return await handleBlacklistCommands(sock, from, userId, content, message);
}

// 🔍 VARREDURA - COM DELEÇÃO DE COMANDO
export async function handleVarreduraCommand(sock, message, content, from, userId) {
    if (content.toLowerCase().trim() !== '#varredura' || !from.endsWith('@g.us')) {
        return false;
    }

    try {
        // DELETA O COMANDO IMEDIATAMENTE
        await deleteCommandMessage(sock, from, message.key);
        
        const groupMetadata = await sock.groupMetadata(from);
        const participant = groupMetadata.participants.find(p => p.id === userId);
        const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        
        if (!isAdmin) {
            const sentMsg = await sock.sendMessage(from, {
                text: '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 🚫 Apenas administradores!'
            });
            setTimeout(() => sock.sendMessage(from, { delete: sentMsg.key }).catch(() => {}), 5000);
        } else {
            console.log(`🔍 Varredura: ${from}`);
            const result = await scanAndRemoveBlacklisted(from, sock);
            const sentMsg = await sock.sendMessage(from, { text: result });
            setTimeout(() => sock.sendMessage(from, { delete: sentMsg.key }).catch(() => {}), 10000);
        }
        return true;
    } catch (err) {
        console.error('❌ Erro #varredura:', err);
        const sentMsg = await sock.sendMessage(from, { text: '❌ Erro ao executar varredura.' });
        setTimeout(() => sock.sendMessage(from, { delete: sentMsg.key }).catch(() => {}), 5000);
        return true;
    }
}

// 🌟 HORÓSCOPO LEGADO
export async function handleHoroscopoLegacy(sock, message, content, from) {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.startsWith('#signos')) {
        await sock.sendMessage(from, { text: listarSignos() });
        return true;
    }
    
    if (lowerContent.startsWith('#horoscopo') || lowerContent.startsWith('#horóscopo')) {
        const args = content.trim().split(/\s+/);
        args.shift();
        await handleHoroscopoCommand(sock, message, args);
        return true;
    }
    
    return false;
}