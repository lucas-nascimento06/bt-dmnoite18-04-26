// blacklistHandler.js
import { 
    addToBlacklist, removeFromBlacklist, 
    isBlacklistedRealtime, listBlacklist, 
    getBlacklistHelp, adminOnlyMessage, normalizeNumber 
} from './blacklistFunctions.js';
import { getGroupAdmins, isUserAdmin } from './grupoUtils.js';

/**
 * Função para deletar mensagem com múltiplas tentativas (IGUAL AO #BAN)
 */
const deleteCommandMessage = async (sock, groupId, messageKey) => {
    const delays = [0, 100, 500, 1000, 2000, 5000];
    
    console.log('🔍 DEBUG DELETE - Recebido:');
    console.log('   - groupId:', groupId);
    console.log('   - messageKey:', JSON.stringify(messageKey, null, 2));
    
    for (let i = 0; i < delays.length; i++) {
        try {
            if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
            
            const key = {
                remoteJid: messageKey.remoteJid || groupId,
                fromMe: false,
                id: messageKey.id,
                participant: messageKey.participant
            };
            
            console.log(`🔍 Tentativa ${i + 1} - Key construída:`, JSON.stringify(key, null, 2));
            
            await sock.sendMessage(groupId, { delete: key });
            console.log(`✅ Comando blacklist deletado (tentativa ${i + 1})`);
            return true;
        } catch (error) {
            console.log(`❌ Tentativa ${i + 1} de deletar comando falhou - Erro:`, error.message);
        }
    }
    return false;
};

/**
 * Handler principal dos comandos da blacklist
 */
export async function handleBlacklistCommands(sock, from, userId, content, msg) {
    const lowerContent = content?.toLowerCase().trim();
    const userMsgKey = msg?.key;

    console.log('\n🔍 ============ DEBUG BLACKLIST HANDLER ============');
    console.log('📥 from:', from);
    console.log('📥 userId:', userId);
    console.log('📥 content:', content);
    console.log('📥 msg recebido:', msg ? 'SIM' : 'NÃO');
    console.log('📥 msg.key existe:', userMsgKey ? 'SIM' : 'NÃO');
    if (userMsgKey) {
        console.log('📥 msg.key detalhes:', JSON.stringify(userMsgKey, null, 2));
    }
    console.log('==================================================\n');

    if (!lowerContent) return false;

    // Função para verificar admin em grupos
    async function requireAdmin() {
        if (from.endsWith('@g.us')) {
            const groupAdmins = await getGroupAdmins(sock, from);
            if (!isUserAdmin(userId, groupAdmins)) {
                // Deleta o comando mesmo se não for admin - COM AWAIT
                await deleteCommandMessage(sock, from, userMsgKey);
                
                const sentMsg = await sock.sendMessage(from, { text: adminOnlyMessage() });
                setTimeout(() => sock.sendMessage(from, { delete: sentMsg.key }).catch(() => {}), 5000);
                return false;
            }
        }
        return true;
    }

    // #addlista - Apenas adiciona à blacklist
    if (lowerContent.startsWith('#addlista ')) {
        // DELETA O COMANDO IMEDIATAMENTE - COM AWAIT
        await deleteCommandMessage(sock, from, userMsgKey);
        
        if (!await requireAdmin()) return true;

        const args = content.split(' ');
        const number = args[1]?.trim();
        if (!number) {
            const sentMsg = await sock.sendMessage(from, { text: '❌ Uso correto: #addlista [número] [motivo opcional]' });
            setTimeout(() => sock.sendMessage(from, { delete: sentMsg.key }).catch(() => {}), 5000);
            return true;
        }

        const now = new Date();
        const formattedDate = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const motivo = args.slice(2).join(' ') || `Adicionado em ${formattedDate}`;

        const result = await addToBlacklist(number, motivo);
        
        const sentMsg = await sock.sendMessage(from, { text: `${result} 🛑` });
        setTimeout(() => sock.sendMessage(from, { delete: sentMsg.key }).catch(() => {}), 5000);
        
        return true;
    }

    // #remlista
    if (lowerContent.startsWith('#remlista ')) {
        // DELETA O COMANDO IMEDIATAMENTE - COM AWAIT
        await deleteCommandMessage(sock, from, userMsgKey);
        
        if (!await requireAdmin()) return true;

        const number = content.replace('#remlista ', '').trim();
        if (!number) {
            const sentMsg = await sock.sendMessage(from, { text: '❌ Uso correto: #remlista [número]' });
            setTimeout(() => sock.sendMessage(from, { delete: sentMsg.key }).catch(() => {}), 5000);
            return true;
        }

        const result = await removeFromBlacklist(number);
        const sentMsg = await sock.sendMessage(from, { text: `${result} 🎉` });
        setTimeout(() => sock.sendMessage(from, { delete: sentMsg.key }).catch(() => {}), 5000);
        return true;
    }

    // #verilista
    if (lowerContent.startsWith('#verilista ')) {
        // DELETA O COMANDO IMEDIATAMENTE - COM AWAIT
        await deleteCommandMessage(sock, from, userMsgKey);
        
        if (!await requireAdmin()) return true;

        const number = content.replace('#verilista ', '').trim();
        if (!number) {
            const sentMsg = await sock.sendMessage(from, { text: '❌ Uso correto: #verilista [número]' });
            setTimeout(() => sock.sendMessage(from, { delete: sentMsg.key }).catch(() => {}), 5000);
            return true;
        }

        const blocked = await isBlacklistedRealtime(number);
        const sentMsg = await sock.sendMessage(from, { text: blocked 
            ? `❌ Número ${number} está na blacklist.` 
            : `✅ Número ${number} não está na blacklist.` });
        setTimeout(() => sock.sendMessage(from, { delete: sentMsg.key }).catch(() => {}), 5000);
        return true;
    }

    // #lista
    if (lowerContent === '#lista') {
        // DELETA O COMANDO IMEDIATAMENTE - COM AWAIT
        await deleteCommandMessage(sock, from, userMsgKey);
        
        if (!await requireAdmin()) return true;

        const result = await listBlacklist();
        const sentMsg = await sock.sendMessage(from, { text: `📋 Lista da Blacklist:\n\n${result}` });
        setTimeout(() => sock.sendMessage(from, { delete: sentMsg.key }).catch(() => {}), 10000);
        return true;
    }

    // #infolista (informativo, liberado para todos)
    if (lowerContent === '#infolista') {
        // DELETA O COMANDO IMEDIATAMENTE - COM AWAIT
        await deleteCommandMessage(sock, from, userMsgKey);
        
        const result = getBlacklistHelp();
        const sentMsg = await sock.sendMessage(from, { text: `ℹ️ Informações da Blacklist:\n\n${result}` });
        setTimeout(() => sock.sendMessage(from, { delete: sentMsg.key }).catch(() => {}), 20000);
        return true;
    }

    return false;
}