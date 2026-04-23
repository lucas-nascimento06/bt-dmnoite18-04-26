// replyTagHandler.js - RESPONDER E MARCAR TODOS (✅ CORRIGIDO COM THUMBNAILS)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { Jimp } from 'jimp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ReplyTagHandler {
    constructor() {
        this.groupsFile = path.join(__dirname, "../../data/groups.json");
        this.loadGroups();
    }

    loadGroups() {
        try {
            if (fs.existsSync(this.groupsFile)) {
                const data = fs.readFileSync(this.groupsFile, 'utf8');
                this.groups = JSON.parse(data);
            } else {
                this.groups = {};
                this.saveGroups();
            }
        } catch (error) {
            console.error('❌ Erro ao carregar grupos:', error);
            this.groups = {};
        }
    }

    saveGroups() {
        try {
            const dir = path.dirname(this.groupsFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.groupsFile, JSON.stringify(this.groups, null, 2));
        } catch (error) {
            console.error('❌ Erro ao salvar grupos:', error);
        }
    }

    async updateGroup(sock, groupId) {
        try {
            const groupMetadata = await sock.groupMetadata(groupId);
            const participants = groupMetadata.participants.map(p => ({
                id: p.id,
                isAdmin: p.admin !== null
            }));

            if (!this.groups[groupId]) this.groups[groupId] = { enabled: true };
            
            this.groups[groupId].name = groupMetadata.subject;
            this.groups[groupId].participants = participants;
            this.groups[groupId].lastUpdated = new Date().toISOString();

            this.saveGroups();
            return participants.length;
        } catch (error) {
            console.error('❌ Erro ao atualizar grupo:', error);
            return 0;
        }
    }

    async processarImagemComJimp(buffer) {
        try {
            console.log(`📦 Buffer recebido: ${buffer.length} bytes`);

            if (buffer.length < 5000) {
                console.log(`⚠️ Imagem muito pequena (${buffer.length} bytes)`);
                return null;
            }

            const image = await Jimp.read(buffer);
            console.log(`📐 Dimensões originais: ${image.getWidth()}x${image.getHeight()}`);
            
            const maxWidth = 1280;
            const maxHeight = 1280;
            
            if (image.getWidth() > maxWidth || image.getHeight() > maxHeight) {
                console.log(`🔧 Redimensionando...`);
                image.scaleToFit({ w: maxWidth, h: maxHeight });
                console.log(`✅ Nova dimensão: ${image.getWidth()}x${image.getHeight()}`);
            }

            const processedBuffer = await image
                .quality(90)
                .getBuffer("image/jpeg");

            console.log(`✅ Imagem processada: ${processedBuffer.length} bytes`);
            
            if (processedBuffer.length > 5 * 1024 * 1024) {
                console.log(`⚠️ Imagem muito grande, reduzindo qualidade...`);
                return await image.quality(75).getBuffer("image/jpeg");
            }
            
            return processedBuffer;

        } catch (error) {
            console.error(`❌ Erro ao processar imagem com Jimp:`, error.message);
            return null;
        }
    }

    async gerarThumbnail(buffer, size = 256) {
        try {
            const image = await Jimp.read(buffer);
            image.scaleToFit({ w: size, h: size });
            return await image.getBuffer("image/jpeg");
        } catch (err) {
            console.error('Erro ao gerar thumbnail:', err);
            return null;
        }
    }

    // ✨ FUNÇÃO PRINCIPAL: Processa RESPOSTAS com comando #totag
    async processReply(sock, from, userId, content, messageKey, message) {
        try {
            if (!from.endsWith('@g.us')) return null;

            const groupId = from;
            const messageObj = message?.message;

            // 🔍 Verifica se é uma RESPOSTA
            const quotedMessage = messageObj?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMessage) return null; // Não é uma resposta

            // 🔍 Verifica se tem o comando #totag (aceita texto, imagem ou vídeo direto)
            const hasTextCommand = content?.toLowerCase().includes('#totag');
            
            // Verifica se a mensagem atual tem imagem/vídeo com #totag
            const currentImageMessage = messageObj?.imageMessage;
            const currentVideoMessage = messageObj?.videoMessage;
            const currentImageCaption = currentImageMessage?.caption || '';
            const currentVideoCaption = currentVideoMessage?.caption || '';
            const hasCurrentImageCommand = currentImageCaption.toLowerCase().includes('#totag');
            const hasCurrentVideoCommand = currentVideoCaption.toLowerCase().includes('#totag');

            if (!hasTextCommand && !hasCurrentImageCommand && !hasCurrentVideoCommand) return null;

            // Verifica se o grupo está ativo
            if (this.groups[groupId] && !this.groups[groupId].enabled) return null;

            // 🔐 VERIFICA SE O USUÁRIO É ADMIN
            const isAdmin = await this.isUserAdmin(sock, groupId, userId);
            if (!isAdmin) {
                const styledTitle = "👏🍻 DﾑMﾑS 💃🔥 Dﾑ NIGӇԵ💃🎶🍾🍸";
                await sock.sendMessage(from, { 
                    text: `${styledTitle}\n\n🚫 *ACESSO NEGADO*\n\n❌ Apenas administradores podem usar o comando \`#totag\`!\n\n👨‍💼 Solicite a um admin para repostar a mensagem.` 
                });
                return { success: true, processed: true };
            }

            // Atualiza o grupo se necessário
            if (!this.groups[groupId] || this.isGroupOutdated(groupId)) {
                await this.updateGroup(sock, groupId);
            }

            const groupData = this.groups[groupId];
            if (!groupData || !groupData.participants) return null;

            // 🗑️ Remove a mensagem do comando
            if (messageKey) {
                try {
                    console.log('🗑️ Removendo mensagem de comando...');
                    await sock.sendMessage(from, { delete: messageKey });
                    console.log('✅ Mensagem de comando removida!');
                } catch (error) {
                    console.error('⚠️ Não foi possível remover mensagem:', error.message);
                }
            }

            // 🗑️ Remove a mensagem original respondida
            const quotedMessageKey = messageObj?.extendedTextMessage?.contextInfo?.stanzaId;
            const quotedParticipant = messageObj?.extendedTextMessage?.contextInfo?.participant;
            
            if (quotedMessageKey) {
                try {
                    console.log('🗑️ Removendo mensagem original respondida...');
                    await sock.sendMessage(from, { 
                        delete: {
                            remoteJid: from,
                            fromMe: false,
                            id: quotedMessageKey,
                            participant: quotedParticipant
                        }
                    });
                    console.log('✅ Mensagem original removida!');
                } catch (error) {
                    console.error('⚠️ Não foi possível remover mensagem original:', error.message);
                }
            }

            const mentions = this.generateMentions(groupData.participants, userId);
            const styledTitle = "👏🍻 DﾑMﾑS 💃🔥 Dﾑ NIGӇԵ💃🎶🍾🍸";

            // 🖼️ PROCESSA IMAGEM DIRETA (sem resposta, apenas #totag na legenda)
            if (currentImageMessage && hasCurrentImageCommand) {
                console.log('🖼️ Processando IMAGEM DIRETA com #totag...');
                
                try {
                    console.log('📥 Baixando imagem original...');
                    const rawBuffer = await downloadMediaMessage(
                        message,
                        'buffer',
                        {},
                        {
                            logger: console,
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );

                    console.log(`📦 Buffer baixado: ${rawBuffer.length} bytes`);

                    // Processa com Jimp
                    const imageBuffer = await this.processarImagemComJimp(rawBuffer);

                    if (!imageBuffer) {
                        throw new Error('Falha ao processar imagem com Jimp');
                    }

                    // Gera thumbnail
                    const thumb = await this.gerarThumbnail(imageBuffer, 256);

                    // Remove o comando da legenda
                    const cleanCaption = currentImageCaption.replace(/#totag/gi, '').trim();
                    const finalCaption = cleanCaption || "💃✨🎉";
                    const fullCaption = `${styledTitle}\n\n${finalCaption}`;

                    // Envia a imagem processada
                    await sock.sendMessage(from, {
                        image: imageBuffer,
                        caption: fullCaption,
                        mentions: mentions,
                        jpegThumbnail: thumb
                    });

                    console.log('✅ Imagem direta reenviada com sucesso!');
                    this.logReplyTag(userId, groupData.name, 'IMAGEM DIRETA', fullCaption, mentions.length);

                    return { success: true, processed: true };
                } catch (error) {
                    console.error('❌ Erro ao processar imagem direta:', error);
                    console.error('Stack:', error.stack);
                    await sock.sendMessage(from, { 
                        text: '❌ Erro ao processar a imagem. Tente novamente.' 
                    });
                    return { success: true, processed: true };
                }
            }

            // 🎥 PROCESSA VÍDEO DIRETO (✅ CORRIGIDO COM THUMBNAIL)
            if (currentVideoMessage && hasCurrentVideoCommand) {
                console.log('🎥 Processando VÍDEO DIRETO com #totag...');
                
                try {
                    console.log('📥 Baixando vídeo original...');
                    const videoBuffer = await downloadMediaMessage(
                        message,
                        'buffer',
                        {},
                        {
                            logger: console,
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );

                    console.log(`📦 Vídeo baixado: ${videoBuffer.length} bytes`);

                    // ✨ EXTRAI THUMBNAIL DO VÍDEO ORIGINAL
                    let jpegThumbnail = null;
                    try {
                        if (currentVideoMessage?.jpegThumbnail) {
                            console.log('🖼️ Usando thumbnail original do vídeo');
                            jpegThumbnail = currentVideoMessage.jpegThumbnail;
                        } else {
                            console.log('⚠️ Vídeo não possui thumbnail');
                        }
                    } catch (thumbError) {
                        console.warn('⚠️ Não foi possível extrair thumbnail:', thumbError.message);
                    }

                    // Remove o comando da legenda
                    const cleanCaption = currentVideoCaption.replace(/#totag/gi, '').trim();
                    const finalCaption = cleanCaption || "💃✨🎉";
                    const fullCaption = `${styledTitle}\n\n${finalCaption}`;

                    await sock.sendMessage(from, {
                        video: videoBuffer,
                        caption: fullCaption,
                        mentions: mentions,
                        jpegThumbnail: jpegThumbnail  // ✅ ADICIONA THUMBNAIL
                    });

                    console.log('✅ Vídeo direto reenviado com sucesso!');
                    this.logReplyTag(userId, groupData.name, 'VÍDEO DIRETO', fullCaption, mentions.length);

                    return { success: true, processed: true };
                } catch (error) {
                    console.error('❌ Erro ao processar vídeo direto:', error);
                    console.error('Stack:', error.stack);
                    await sock.sendMessage(from, { 
                        text: '❌ Erro ao processar o vídeo. Tente novamente.' 
                    });
                    return { success: true, processed: true };
                }
            }

            // 🖼️ REPOSTA IMAGEM DA MENSAGEM ORIGINAL
            if (quotedMessage.imageMessage) {
                console.log('🖼️ Repostando IMAGEM da mensagem respondida...');
                
                try {
                    // Cria mensagem temporária para download
                    const tempMessage = {
                        message: { imageMessage: quotedMessage.imageMessage }
                    };

                    console.log('📥 Baixando imagem da mensagem respondida...');
                    const rawBuffer = await downloadMediaMessage(
                        tempMessage,
                        'buffer',
                        {},
                        {
                            logger: console,
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );

                    console.log(`📦 Buffer baixado: ${rawBuffer.length} bytes`);

                    // Processa com Jimp
                    const imageBuffer = await this.processarImagemComJimp(rawBuffer);

                    if (!imageBuffer) {
                        throw new Error('Falha ao processar imagem com Jimp');
                    }

                    // Gera thumbnail
                    const thumb = await this.gerarThumbnail(imageBuffer, 256);

                    // Captura legenda original ou usa a do comando
                    const originalCaption = quotedMessage.imageMessage.caption || '';
                    const commandCaption = currentImageCaption.replace(/#totag/gi, '').trim();
                    const finalCaption = commandCaption || originalCaption || "💃✨🎉";
                    const fullCaption = `${styledTitle}\n\n${finalCaption}`;

                    // Envia a imagem repostada
                    await sock.sendMessage(from, {
                        image: imageBuffer,
                        caption: fullCaption,
                        mentions: mentions,
                        jpegThumbnail: thumb
                    });

                    console.log('✅ Imagem repostada com sucesso!');
                    this.logReplyTag(userId, groupData.name, 'IMAGEM', fullCaption, mentions.length);

                    return { success: true, processed: true };
                } catch (error) {
                    console.error('❌ Erro ao repostar imagem:', error);
                    console.error('Stack:', error.stack);
                    await sock.sendMessage(from, { 
                        text: '❌ Erro ao repostar a imagem. Tente novamente.' 
                    });
                    return { success: true, processed: true };
                }
            }

            // 🎥 REPOSTA VÍDEO DA MENSAGEM ORIGINAL (✅ CORRIGIDO COM THUMBNAIL)
            if (quotedMessage.videoMessage) {
                console.log('🎥 Repostando VÍDEO da mensagem respondida...');
                
                try {
                    // Cria mensagem temporária para download
                    const tempMessage = {
                        message: { videoMessage: quotedMessage.videoMessage }
                    };

                    console.log('📥 Baixando vídeo da mensagem respondida...');
                    const videoBuffer = await downloadMediaMessage(
                        tempMessage,
                        'buffer',
                        {},
                        {
                            logger: console,
                            reuploadRequest: sock.updateMediaMessage
                        }
                    );

                    console.log(`📦 Vídeo baixado: ${videoBuffer.length} bytes`);

                    // ✨ EXTRAI THUMBNAIL DO VÍDEO ORIGINAL
                    let jpegThumbnail = null;
                    try {
                        if (quotedMessage.videoMessage?.jpegThumbnail) {
                            console.log('🖼️ Usando thumbnail original do vídeo respondido');
                            jpegThumbnail = quotedMessage.videoMessage.jpegThumbnail;
                        } else {
                            console.log('⚠️ Vídeo respondido não possui thumbnail');
                        }
                    } catch (thumbError) {
                        console.warn('⚠️ Não foi possível extrair thumbnail:', thumbError.message);
                    }

                    // Captura legenda original ou usa a do comando
                    const originalCaption = quotedMessage.videoMessage.caption || '';
                    const commandCaption = currentVideoCaption.replace(/#totag/gi, '').trim();
                    const finalCaption = commandCaption || originalCaption || "💃✨🎉";
                    const fullCaption = `${styledTitle}\n\n${finalCaption}`;

                    await sock.sendMessage(from, {
                        video: videoBuffer,
                        caption: fullCaption,
                        mentions: mentions,
                        jpegThumbnail: jpegThumbnail  // ✅ ADICIONA THUMBNAIL
                    });

                    console.log('✅ Vídeo repostado com sucesso!');
                    this.logReplyTag(userId, groupData.name, 'VÍDEO', fullCaption, mentions.length);

                    return { success: true, processed: true };
                } catch (error) {
                    console.error('❌ Erro ao repostar vídeo:', error);
                    console.error('Stack:', error.stack);
                    await sock.sendMessage(from, { 
                        text: '❌ Erro ao repostar o vídeo. Tente novamente.' 
                    });
                    return { success: true, processed: true };
                }
            }

            // 📝 REPOSTA TEXTO DA MENSAGEM ORIGINAL
            if (quotedMessage.conversation || quotedMessage.extendedTextMessage) {
                console.log('📝 Repostando TEXTO da mensagem respondida...');
                
                const originalText = quotedMessage.conversation || 
                                   quotedMessage.extendedTextMessage?.text || 
                                   '';
                
                const commandText = content.replace(/#totag/gi, '').trim();
                const finalText = commandText || originalText || "💃✨🎉";
                const fullMessage = `${styledTitle}\n\n${finalText}`;

                await sock.sendMessage(from, {
                    text: fullMessage,
                    mentions: mentions
                });

                console.log('✅ Texto repostado com sucesso!');
                this.logReplyTag(userId, groupData.name, 'TEXTO', fullMessage, mentions.length);

                return { success: true, processed: true };
            }

            // Se chegou aqui, tipo de mensagem não suportado
            await sock.sendMessage(from, { 
                text: '⚠️ Tipo de mensagem não suportado para repostar.\n\n✅ Suportados: Texto, Imagem, Vídeo' 
            });

            return { success: true, processed: true };

        } catch (error) {
            console.error('❌ Erro ao processar reply tag:', error);
            console.error('Stack:', error.stack);
            return null;
        }
    }

    logReplyTag(userId, groupName, type, content, mentionsCount) {
        console.log(`\n🔁 ========= REPLY TAG (${type}) =========`);
        console.log(`👤 Admin: ${userId}`);
        console.log(`📱 Grupo: ${groupName}`);
        console.log(`📝 Conteúdo: ${content.substring(0, 100)}...`);
        console.log(`👥 Marcados: ${mentionsCount} pessoas`);
        console.log(`🕒 ${new Date().toLocaleString('pt-BR')}`);
        console.log(`=====================================\n`);
    }

    async isUserAdmin(sock, groupId, userId) {
        try {
            if (sock.isGroupAdmin) {
                return await sock.isGroupAdmin(groupId, userId);
            }
            const groupMetadata = await sock.groupMetadata(groupId);
            const participant = groupMetadata.participants.find(p => p.id === userId);
            return participant?.admin !== null && participant?.admin !== undefined;
        } catch (error) {
            console.error('❌ Erro ao verificar admin:', error);
            return false;
        }
    }

    generateMentions(participants, authorId) {
        return participants.filter(p => p.id !== authorId).map(p => p.id);
    }

    isGroupOutdated(groupId) {
        if (!this.groups[groupId]?.lastUpdated) return true;
        const lastUpdate = new Date(this.groups[groupId].lastUpdated);
        return (Date.now() - lastUpdate.getTime()) > 3600000;
    }

    async handleAdminCommands(sock, from, userId, content) {
        if (!from.endsWith('@g.us')) return false;
        if (!content.startsWith('!replytag-')) return false;

        const isAdmin = await this.isUserAdmin(sock, from, userId);
        if (!isAdmin) {
            await sock.sendMessage(from, { text: '❌ Apenas administradores podem usar comandos do ReplyTag!' });
            return true;
        }

        if (content === '!replytag-help') {
            const helpText = `
🔁 *COMANDOS DO REPLYTAG*

👨‍💼 *Para Administradores:*

📝 *COMO USAR:*

*MODO 1 - Enviar Direto:*
1️⃣ Envie texto, imagem ou vídeo
2️⃣ Adicione \`#totag\` na mensagem ou legenda
3️⃣ Será enviado marcando todos!

*MODO 2 - Responder:*
1️⃣ Responda qualquer mensagem (texto, imagem ou vídeo)
2️⃣ Digite \`#totag\` na sua resposta
3️⃣ A mensagem será repostada marcando todos!

✨ *Exemplos:*

📝 *Enviar Texto:*
\`Festa hoje! #totag\`

🖼️ *Enviar Imagem:*
📸 Envie foto com legenda: \`Olha isso! #totag\`

🎥 *Enviar Vídeo:*
🎬 Envie vídeo com legenda: \`Novo vídeo! #totag\`

🔁 *Repostar Mensagem:*
- Responda qualquer mensagem
- Digite: \`#totag\`

💃 *Resultado:*
👏🍻 DﾑMﾑS 💃🔥 Dﾑ NIGӇԵ💃🎶🍾🍸

[Conteúdo repostado]

🔔 *Todos os membros recebem notificação automaticamente*

⚠️ *Notas:*
- Apenas administradores podem usar
- A mensagem original será removida
- Funciona com texto, imagem e vídeo
- Pode enviar direto ou responder mensagens
            `.trim();
            await sock.sendMessage(from, { text: helpText });
            return true;
        }

        if (content === '!replytag-status') {
            const status = this.getGroupStatus(from);
            const statusText = `
🔁 *STATUS DO REPLYTAG*

📊 *Participantes:* ${status.participants}
🔧 *Ativo:* ${status.enabled ? '✅ Sim' : '❌ Não'}
🔐 *Restrição:* 👨‍💼 Apenas Administradores
🕒 *Última Atualização:* ${status.lastUpdated !== 'Nunca' ? new Date(status.lastUpdated).toLocaleString('pt-BR') : 'Nunca'}

*Use !replytag-help para ver como usar*
            `.trim();
            await sock.sendMessage(from, { text: statusText });
            return true;
        }

        return false;
    }

    getGroupStatus(groupId) {
        const group = this.groups[groupId];
        return {
            enabled: group?.enabled ?? true,
            participants: group?.participants?.length ?? 0,
            lastUpdated: group?.lastUpdated ?? 'Nunca'
        };
    }
}

export default ReplyTagHandler;