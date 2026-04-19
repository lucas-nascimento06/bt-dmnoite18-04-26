// bot/codigos/grupoUtils.js
import { normalizeNumber } from './blacklistFunctions.js';

export async function getGroupAdmins(sock, from) {
    try {
        if (!from.endsWith('@g.us')) return [];
        
        const groupMetadata = await sock.groupMetadata(from);
        const groupAdmins = groupMetadata.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => normalizeNumber(p.id));
        
        return groupAdmins;
    } catch (error) {
        console.error('❌ Erro ao obter admins do grupo:', error);
        return [];
    }
}

export function isUserAdmin(userId, groupAdmins) {
    const normalizedUserId = normalizeNumber(userId);
    return groupAdmins.includes(normalizedUserId);
}
