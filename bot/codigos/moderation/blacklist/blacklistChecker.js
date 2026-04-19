import pool from "../../../../db.js";
import { normalizeNumber } from './blacklistFunctions.js';

const BOT_TITLE = '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸';

export async function verificarBlacklistAgora(sock, groupId) {
    try {
        const metadata = await sock.groupMetadata(groupId);
        const participants = metadata.participants.map(p => p.id);

        // Ignora o próprio bot
        const filteredParticipants = participants.filter(p => p !== sock.user.jid);
        if (filteredParticipants.length === 0) return [];

        // Normaliza os números
        const normalizedIds = filteredParticipants.map(p => normalizeNumber(p));

        // 🔹 Consulta única no banco
        const query = `
            SELECT whatsapp_id
            FROM blacklist
            WHERE whatsapp_id = ANY($1::text[])
        `;
        const result = await pool.query(query, [normalizedIds]);
        const blockedParticipants = result.rows.map(r => r.whatsapp_id);

        // Remove do grupo todos os que estão na blacklist
        if (blockedParticipants.length > 0) {
            await sock.groupParticipantsUpdate(groupId, blockedParticipants, 'remove');

            blockedParticipants.forEach(p => {
                console.log(`🚨 ${BOT_TITLE} Usuário ${p} removido do grupo ${groupId} (blacklist)`);
            });
        }

        return blockedParticipants;
    } catch (err) {
        console.error(`❌ ${BOT_TITLE} Erro ao verificar blacklist do grupo:`, err);
        return [];
    }
}
