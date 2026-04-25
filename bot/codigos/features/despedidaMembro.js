// despedidaMembro.js -> E chamada no bot.js

import { Jimp } from 'jimp';
import axios from 'axios';

const GRUPO_PRINCIPAL = '120363419322682521@g.us';

/**
 * Gera uma thumbnail a partir de uma URL ou buffer.
 * @param {Buffer|string} input - Buffer da imagem ou URL
 * @param {number} size - tamanho da thumbnail (padrão 256)
 * @returns {Promise<Buffer|null>} - Retorna buffer da thumbnail PNG
 */
async function gerarThumbnail(input, size = 256) {
    try {
        let buffer;
        if (typeof input === 'string') {
            const res = await axios.get(input, { responseType: 'arraybuffer' });
            buffer = Buffer.from(res.data, 'binary');
        } else {
            buffer = input;
        }

        const image = await Jimp.read(buffer);
        image.resize({ w: size, h: size });
        return await image.getBuffer("image/png");
    } catch (err) {
        console.error('Erro ao gerar thumbnail:', err);
        return null;
    }
}

/**
 * Envia imagem/GIF com thumbnail
 * @param {object} sock - instância do Baileys
 * @param {string} jid - ID do grupo ou usuário
 * @param {Buffer} buffer - Buffer da imagem/GIF
 * @param {string} caption - legenda da mensagem
 * @param {string[]} mentions - array com IDs de menções
 */
async function sendMediaWithThumbnail(sock, jid, buffer, caption, mentions = []) {
    try {
        const thumb = await gerarThumbnail(buffer);
        await sock.sendMessage(jid, {
            image: buffer,
            caption,
            mentions,
            jpegThumbnail: thumb
        });
    } catch (err) {
        console.error('Erro ao enviar mídia com thumbnail:', err);
        await sock.sendMessage(jid, { text: caption, mentions });
    }
}

/**
 * Função auxiliar para extrair o identificador correto do participant
 * EXATAMENTE IGUAL AO AVISOADM.JS
 */
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

/**
 * Configura mensagens de despedida para participantes que saem do grupo
 * ESTRUTURA IGUAL AO AVISOADM.JS - Recebe update completo
 * 
 * @param {object} socket - instância do Baileys
 * @param {object} update - Objeto de atualização completo do grupo
 */
export const configurarDespedida = async (socket, update) => {
    try {
        console.log('🔍 DEBUG DESPEDIDA - Início da função');
        console.log('Update recebido:', JSON.stringify(update, null, 2));

        // ✅ VALIDAÇÃO: Verifica se há participantes
        if (!update.participants || update.participants.length === 0) {
            console.log('❌ Nenhum participante para processar');
            return;
        }

        // ✅ EXATAMENTE IGUAL AO AVISOADM: Extrai dados do update
        const participantData = update.participants[0];
        const participant = getParticipantId(participantData);
        
        console.log('📋 participantData:', participantData);
        console.log('📋 participant extraído:', participant);
        
        // Extrai o número para a menção e o nome do participante
        const participantPhoneNumber = participant.split('@')[0];
        const participantName = participantData?.pushname || participantPhoneNumber || "Usuário";
        
        console.log('📱 participantPhoneNumber:', participantPhoneNumber);
        console.log('👤 participantName:', participantName);
        
        // Para comparação de IDs (quando é objeto, usa o .id)
        const participantIdForComparison = typeof participantData === 'object' && participantData !== null 
            ? participantData.id 
            : participant;
        
        const author = update.author;
        const groupId = update.id;

        // ✅ SÓ PROCESSA SE FOR O GRUPO PRINCIPAL
        if (groupId !== GRUPO_PRINCIPAL) {
            console.log(`❌ Grupo ${groupId} não é o grupo principal. Despedida ignorada.`);
            return;
        }

        console.log('🔍 COMPARAÇÃO:');
        console.log('  participantIdForComparison:', participantIdForComparison);
        console.log('  author:', author);

        // ✅ EXATAMENTE IGUAL AO AVISOADM: Verifica se o usuário saiu por conta própria
        const isUserLeftByThemselves = participantIdForComparison === author;

        console.log('  São iguais?', isUserLeftByThemselves);

        // ✅ SÓ ENVIA DESPEDIDA SE O USUÁRIO SAIU POR CONTA PRÓPRIA
        if (!isUserLeftByThemselves) {
            console.log('❌ Usuário foi removido por admin, despedida não será enviada.');
            return;
        }

        console.log('✅ Usuário saiu voluntariamente, enviando despedida...');

        // Lista de URLs de imagens/GIFs de despedida
        const farewellImages = [
            'https://i.ibb.co/bR2SSbXY/Image-fx-1.jpg',
            'https://i.ibb.co/8DgwmP9n/Image-fx-2.jpg',
            'https://i.ibb.co/tMXFRd3Z/Image-fx-3.jpg',
            'https://i.ibb.co/YFPZ9rJg/Image-fx-4.jpg',
            'https://i.ibb.co/3yp47ctx/Image-fx-5.jpg',
            'https://i.ibb.co/hzKRnpm/Image-fx-6.jpg',
            'https://i.ibb.co/39c3sY6D/Image-fx-7.jpg',
            'https://i.ibb.co/hJW3XQYj/Image-fx-8.jpg',
            'https://i.ibb.co/S77tQ6yz/Image-fx-9.jpg',
            'https://i.ibb.co/ZztMmTHF/Image-fx-10.jpg',
            'https://i.ibb.co/9H5ZyKPL/Image-fx-11.jpg',
            'https://i.ibb.co/ZzzQMyB4/Image-fx-12.jpg',
            'https://i.ibb.co/MxBGN8qt/Image-fx-13.jpg',
            'https://i.ibb.co/TMqvqjX7/Image-fx-14.jpg',
            'https://i.ibb.co/JFxMd2z1/Image-fx-15.jpg',
            'https://i.ibb.co/Y4KMSYYZ/Image-fx-16.jpg',
            'https://i.ibb.co/p8LR5wx/Image-fx-17.jpg',
            'https://i.ibb.co/3yGPBnsh/Image-fx-18.jpg',
            'https://i.ibb.co/93VyVFh7/Image-fx-19.jpg',
            'https://i.ibb.co/6jTNzmh/Image-fx-20.jpg',
            'https://i.ibb.co/Qj3Yfmdr/Image-fx-21.jpg',
            'https://i.ibb.co/VYHL0RtS/Image-fx-22.jpg',
            'https://i.ibb.co/Zp10phZs/Image-fx-23.jpg',
            'https://i.ibb.co/LdQHVHkm/Image-fx-24.jpg',
            'https://i.ibb.co/3Y5yyr3w/Image-fx-25.jpg',
            'https://i.ibb.co/5WQDwkK2/Image-fx-26.jpg',
            'https://i.ibb.co/Cs2SvWmp/Image-fx-27.jpg',
            'https://i.ibb.co/N69HzHtD/Image-fx-28.jpg',
            'https://i.ibb.co/DPBcV89j/Image-fx-29.jpg',
            'https://i.ibb.co/xKHRbFcj/Image-fx-30.jpg',
            'https://i.ibb.co/5gTZd7Z4/Image-fx-31.jpg',
            'https://i.ibb.co/Vh4mhCJ/Image-fx.jpg'
        ];

        // Lista de mensagens de despedida
        const farewellMessages = [
        `💔 *Pior que "quem é você?"* @${participantName}\nO grupo vai ficar mais leve agora, e talvez até com mais inteligência.😏😹\nBoa sorte no mundo real! 😹`,
        
        ];

        // Seleciona imagem e mensagem aleatórias
        const randomImage = farewellImages[Math.floor(Math.random() * farewellImages.length)];
        const randomMessage = farewellMessages[Math.floor(Math.random() * farewellMessages.length)];

        console.log('📤 Enviando despedida...');
        console.log('🖼️ Imagem selecionada:', randomImage);
        console.log('💬 Mensagem:', randomMessage);

        // Baixa e envia a imagem com mensagem
        const res = await axios.get(randomImage, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(res.data, 'binary');

        await sendMediaWithThumbnail(socket, groupId, buffer, randomMessage, [participant]);
        
        console.log('✅ Despedida enviada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao processar despedida:', error.message);
        console.error('Stack:', error.stack);
    }
};