// bot/handlers/addHandler.js
import { configurarBoasVindas } from '../codigos/features/boasVindas.js';
import { onUserJoined, isBlacklistedRealtime } from '../codigos/moderation/blacklist/blacklistFunctions.js';

// ✅ Função auxiliar para extrair ID do participant (string ou objeto)
const getParticipantId = (participantData) => {
    // Se for string (versão antiga), retorna direto
    if (typeof participantData === 'string') {
        return participantData;
    }
    // Se for objeto (versão nova), extrai phoneNumber ou id
    if (typeof participantData === 'object' && participantData !== null) {
        return participantData.phoneNumber || participantData.id;
    }
    return participantData;
};

export async function handleUserAdd(sock, groupId, participants) {
    for (const participantData of participants) {
        // ✅ CORREÇÃO: Extrai o ID correto (funciona com string ou objeto)
        const participant = getParticipantId(participantData);
        const userPhone = participant.split('@')[0];

        console.log(`\n🔍 ========= VERIFICAÇÃO DE BLACKLIST =========`);
        console.log(`👤 Verificando: ${participant}`);
        console.log(`📱 Telefone: ${userPhone}`);
        
        // Delay para garantir processamento
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Resolve LID para número real
        const realNumber = await resolveUserNumber(sock, groupId, participant);
        
        // Verifica blacklist e remove se necessário
        await onUserJoined(realNumber, groupId, sock, participant);
        
        // Envia boas-vindas se não estiver bloqueado
        const isBlocked = await isBlacklistedRealtime(realNumber);
        if (!isBlocked) {
            console.log(`✅ ${userPhone} não está na blacklist - enviando boas-vindas`);
            await configurarBoasVindas(sock, groupId, participant);
        }
        
        console.log(`==============================================\n`);
    }
}

async function resolveUserNumber(sock, groupId, participant) {
    let realNumber = participant;
    
    if (participant.includes('@lid')) {
        try {
            console.log('🔍 LID detectado! Buscando número real...');
            const metadata = await sock.groupMetadata(groupId);
            const participantData = metadata.participants.find(p => p.id === participant);
            
            if (participantData?.phoneNumber) {
                realNumber = participantData.phoneNumber;
                console.log(`✅ Número real encontrado: ${realNumber}`);
            } else {
                console.log('⚠️ phoneNumber não encontrado no metadata');
            }
        } catch (err) {
            console.log('⚠️ Erro ao resolver LID:', err.message);
        }
    }
    
    return realNumber;
}