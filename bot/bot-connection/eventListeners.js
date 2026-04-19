// bot/connection/eventListeners.js
import { handleMessages, handleReactions } from '../codigos/handlers/message/messageHandler.js';
import { setupClient } from '../codigos/features/avisoadm.js';
import { handleGroupParticipantsEvent } from "../bot-handlers/participantsHandler.js";
import { handleVerifListaCommand } from "../bot-handlers/verifListaHandler.js";

export function setupEventListeners(sock) {
    // Event listener de participantes do grupo
    sock.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantsEvent(sock, update);
    });

    // Event listener de mensagens
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== 'notify') return;

        try {
            const validMessages = messages.filter(msg =>
                msg &&
                !msg.key.fromMe &&
                msg.messageTimestamp &&
                (Date.now() - (msg.messageTimestamp * 1000)) < 30000
            );

            for (const message of validMessages) {
                await handleMessages(sock, message);

                const messageText = message.message?.conversation || 
                                  message.message?.extendedTextMessage?.text;
                
                if (messageText && messageText.toLowerCase() === '#veriflista') {
                    await handleVerifListaCommand(sock, message);
                }
            }
        } catch (error) {
            console.error('❌ Erro no listener de mensagens:', error);
        }
    });

    // 👁️ Event listener de reações (NOVO!)
    sock.ev.on('messages.reaction', async (reaction) => {
        try {
            console.log('👁️ Reação detectada:', reaction);
            await handleReactions(sock, reaction);
        } catch (error) {
            console.error('❌ Erro no listener de reações:', error);
        }
    });

    // Configura reconexão automática do avisoadm.js
    setupClient(sock);
}