// bot/handlers/participantsHandler.js
import { handleGroupParticipantsUpdate as handleAdminNotifications } from '../codigos/features/avisoadm.js';
import { updateGroupOnJoin } from '../codigos/handlers/message/messageHandler.js';
import { handleUserAdd } from './addHandler.js';
import { handleUserRemove } from './removeHandler.js';

export async function handleGroupParticipantsEvent(sock, update) {
    try {
        const groupId = update.id;
        const action = update.action;

        console.log(`\n👥 ========= EVENTO DE GRUPO =========`);
        console.log(`📱 Grupo: ${groupId}`);
        console.log(`🎬 Ação: "${action}" (tipo: ${typeof action})`);
        console.log(`👤 Participantes:`, update.participants);
        console.log(`📋 Update completo:`, JSON.stringify(update, null, 2));
        console.log(`=====================================\n`);

        // 1️⃣ Notificações de promoção/demissão
        await handleAdminNotifications(sock, update, sock.user);

        // 2️⃣ Processar adições (blacklist + boas-vindas)
        if (action === 'add') {
            await handleUserAdd(sock, groupId, update.participants);
        }

        // 3️⃣ Processar saídas e remoções (despedida)
        // ✅ CORREÇÃO: Passa o update completo
        if (action === 'remove' || action === 'leave') {
            await handleUserRemove(sock, update);
        }

        // 4️⃣ Auto-atualizar grupo para AutoTag
        if (['add', 'remove', 'leave', 'promote', 'demote'].includes(action)) {
            await updateGroupOnJoin(sock, groupId);
            console.log(`🏷️ Grupo ${groupId} atualizado para AutoTag`);
        }

    } catch (error) {
        console.error('❌ Erro no evento de participantes:', error);
        console.error('Stack completo:', error.stack);
    }
}