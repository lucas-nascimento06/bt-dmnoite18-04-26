// bot/handlers/verifListaHandler.js
import { verificarBlacklistAgora } from "../codigos/moderation/blacklist/blacklistChecker.js";

const BOT_TITLE = '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸';

export async function handleVerifListaCommand(sock, message) {
    const groupId = message.key.remoteJid;
    const sender = message.key.participant || message.key.remoteJid;

    // Verifica se é admin
    const metadata = await sock.groupMetadata(groupId);
    const participantData = metadata.participants.find(p => p.id === sender);
    const isAdmin = participantData?.admin === 'admin' || participantData?.admin === 'superadmin';

    if (!isAdmin) {
        const adminMsg = await sock.sendMessage(groupId, {
            text: `${BOT_TITLE} ❌ Apenas administradores podem usar este comando.`
        });
        
        setTimeout(async () => {
            await sock.sendMessage(groupId, {
                delete: {
                    remoteJid: adminMsg.key.remoteJid,
                    id: adminMsg.key.id,
                    fromMe: true
                }
            });
        }, 8000);
        return;
    }

    // Executa verificação
    const checkingMsg = await sock.sendMessage(groupId, {
        text: `${BOT_TITLE} 🔎 Checando a blacklist...`
    });
    
    const removidos = await verificarBlacklistAgora(sock, groupId);

    const resultText = removidos.length > 0
        ? `${BOT_TITLE} 🚨 *Blacklist Atualizada* 💃🎶\n✅ ${removidos.length} usuário(s) removido(s) do grupo:\n• ${removidos.join('\n• ')}`
        : `${BOT_TITLE} ✅ Nenhum usuário da blacklist encontrado neste grupo.`;

    const resultMsg = await sock.sendMessage(groupId, { text: resultText });

    // Auto-delete das mensagens
    setTimeout(async () => {
        await sock.sendMessage(groupId, {
            delete: {
                remoteJid: checkingMsg.key.remoteJid,
                id: checkingMsg.key.id,
                fromMe: true
            }
        });
        await sock.sendMessage(groupId, {
            delete: {
                remoteJid: resultMsg.key.remoteJid,
                id: resultMsg.key.id,
                fromMe: true
            }
        });
    }, 8000);
}