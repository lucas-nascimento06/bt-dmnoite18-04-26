import { registrarMensagem } from '../utils/rainhaModel';

// 🔥 CACHE ANTI-DUPLICATA APENAS
const processedMessages = new Set();
const MESSAGE_CACHE_LIMIT = 200;

// 🔥 TIPOS DE MENSAGEM QUE DEVEM SER CONTADOS
const TIPOS_VALIDOS = new Set([
    'conversation',
    'extendedTextMessage',
    'imageMessage',
    'videoMessage',
    'stickerMessage',
    'audioMessage'
]);

function extractDigits(number) {
    if (!number) return null;
    return number.replace(/@.*$/, '').replace(/\D/g, '');
}

function isMessageProcessed(messageKey) {
    const uniqueId = `${messageKey.remoteJid}_${messageKey.id}`;
    if (processedMessages.has(uniqueId)) return true;
    processedMessages.add(uniqueId);
    if (processedMessages.size > MESSAGE_CACHE_LIMIT) {
        const toDelete = processedMessages.size - MESSAGE_CACHE_LIMIT;
        const iterator = processedMessages.values();
        for (let i = 0; i < toDelete; i++) {
            processedMessages.delete(iterator.next().value);
        }
    }
    return false;
}

function getNumeroReal(message) {
    if (message.key.participantAlt) return message.key.participantAlt;
    if (message.key.participant) return message.key.participant;
    if (message.key.remoteJid) return message.key.remoteJid;
    return null;
}

function getMessageType(msg) {
    for (const tipo of Object.keys(msg)) {
        if (TIPOS_VALIDOS.has(tipo)) {
            return tipo;
        }
    }
    return null;
}

export async function trackMensagem(client, message) {
    try {
        // Verificação de duplicata
        if (isMessageProcessed(message.key)) return;
        
        // Só processa grupos
        if (!message?.key?.remoteJid?.endsWith('@g.us')) return;
        
        // Ignora mensagens do próprio bot
        if (message.key.fromMe) return;

        let msg = message.message;
        if (!msg) return;

        // Desembrulha mensagens ephemeral e viewOnce
        if (msg.ephemeralMessage) msg = msg.ephemeralMessage.message;
        if (msg.viewOnceMessage) msg = msg.viewOnceMessage.message;

        // Detecta o tipo da mensagem
        const tipoMsg = getMessageType(msg);
        if (!tipoMsg) return;

        const grupoId = message.key.remoteJid;
        
        // Pega o número real do usuário
        const numeroCompleto = getNumeroReal(message);
        if (!numeroCompleto) return;

        let numeroLimpo = extractDigits(numeroCompleto);
        
        // Corrige se ainda tiver LID
        if (numeroLimpo && (numeroLimpo.includes('lid') || numeroLimpo.length < 10)) {
            if (message.key.participantAlt) {
                const altLimpo = extractDigits(message.key.participantAlt);
                if (altLimpo && !altLimpo.includes('lid') && altLimpo.length >= 10) {
                    numeroLimpo = altLimpo;
                }
            }
        }
        
        if (!numeroLimpo || numeroLimpo.length < 10) return;

        // Mapeia o tipo para exibição amigável
        let tipoExibicao = '';
        switch(tipoMsg) {
            case 'conversation': tipoExibicao = 'texto'; break;
            case 'extendedTextMessage': tipoExibicao = 'texto'; break;
            case 'imageMessage': tipoExibicao = 'imagem'; break;
            case 'videoMessage': tipoExibicao = 'vídeo'; break;
            case 'stickerMessage': tipoExibicao = 'sticker'; break;
            case 'audioMessage': tipoExibicao = 'áudio'; break;
            default: tipoExibicao = tipoMsg;
        }

        console.log(`✅ CONTANDO: ${tipoExibicao} de ${numeroLimpo}`);
        
        let nome = message.pushName || 'Desconhecido';
        
        // Salva no banco de dados
        await registrarMensagem(grupoId, numeroLimpo, nome, null);
        console.log(`💾 SALVO: ${tipoExibicao} - ${numeroLimpo}`);

    } catch (err) {
        console.error('[trackMensagem] Erro:', err.message);
    }
}