// commandPriorities.js - MÓDULO PRINCIPAL COMPACTO
import { handleOwnerMenu } from '../../features/menuOwner.js';
import { handleGroupCommands } from "../../utils/redefinirFecharGrupo.js";
import alertaHandler from '../../moderation/alertaHandler.js';
import { 
    handleSignosCommands,
    handleBlacklistGroup,
    handleVarreduraCommand,
    handleHoroscopoLegacy
} from './commandHandlers.js';

export async function processCommandPriorities(
    sock, message, from, userId, content,
    OWNER_NUMBERS, autoTag, pool
) {
    let handled = false;

    // 🚨 PRIORIDADE 0: #ALERTA
    if (!handled) {
        handled = await alertaHandler(sock, message);
        if (handled) return true;
    }

    // 👑 PRIORIDADE 1: MENU OWNER
    if (!handled) handled = await handleOwnerMenu(sock, from, userId, content, OWNER_NUMBERS);

    // ✅ #BAN removido daqui — já tratado com early return em messageHandler.js
    // Manter aqui causava chamada dupla e processamento redundante.

    // 🔹 PRIORIDADE 2: ADMIN GRUPO (#rlink, #closegp, #opengp)
    if (!handled) handled = await handleGroupCommands(sock, message);

    // 🔹 PRIORIDADE 3-4: AUTOTAG
    if (!handled && from.endsWith('@g.us')) {
        handled = await autoTag.handleAdminCommands(sock, from, userId, content);
        if (!handled) {
            const tagResult = await autoTag.processMessage(sock, from, userId, content, message.key, message);
            if (tagResult?.processed) return true;
        }
    }

    // 🌟 PRIORIDADES 5-8: OUTROS COMANDOS
    if (!handled) handled = await handleSignosCommands(sock, message, content, from);
    if (!handled) handled = await handleBlacklistGroup(sock, from, userId, content, message);
    if (!handled) handled = await handleVarreduraCommand(sock, message, content, from, userId);
    if (!handled) handled = await handleHoroscopoLegacy(sock, message, content, from);

    return handled;
}