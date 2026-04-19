// autoTagHandler.js - VERSÃO COM PROCESSAMENTO DE IMAGEM VIA JIMP E THUMBNAIL PARA VÍDEOS
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import axios from 'axios';
import Jimp from 'jimp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AutoTagHandler {
  constructor() {
    this.groupsFile = path.join(__dirname, "../../data/groups.json");
    this.loadGroups();
    
    // ✅ Cache para evitar processar a mesma mensagem 2x
    this.processedMessages = new Set();
    
    // Limpa cache a cada 5 minutos
    setInterval(() => {
      this.processedMessages.clear();
      console.log('🧹 Cache de mensagens processadas limpo');
    }, 5 * 60 * 1000);
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

      if (!this.groups[groupId]) this.groups[groupId] = { enabled: true, adminOnly: false };

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

  /**
   * Processa imagem com Jimp (mesmo esquema do hqseroticos.js)
   */
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
        image.scaleToFit(maxWidth, maxHeight);
        console.log(`✅ Nova dimensão: ${image.getWidth()}x${image.getHeight()}`);
      }

      const processedBuffer = await image
        .quality(90)
        .getBufferAsync(Jimp.MIME_JPEG);

      console.log(`✅ Imagem processada: ${processedBuffer.length} bytes`);

      if (processedBuffer.length > 5 * 1024 * 1024) {
        console.log(`⚠️ Imagem muito grande, reduzindo qualidade...`);
        return await image.quality(75).getBufferAsync(Jimp.MIME_JPEG);
      }

      return processedBuffer;
    } catch (error) {
      console.error(`❌ Erro ao processar imagem com Jimp:`, error.message);
      return null;
    }
  }

  /**
   * Gera thumbnail com Jimp
   */
  async gerarThumbnail(buffer, size = 256) {
    try {
      const image = await Jimp.read(buffer);
      image.scaleToFit(size, size);
      return await image.getBufferAsync(Jimp.MIME_JPEG);
    } catch (err) {
      console.error('Erro ao gerar thumbnail:', err);
      return null;
    }
  }

  // ✨ FUNÇÃO PRINCIPAL: Processa mensagens com TEXTO, IMAGEM ou VÍDEO
  async processMessage(sock, from, userId, content, messageKey, message) {
    try {
      // ========================================
      // ✅ PROTEÇÃO CONTRA LOOP INFINITO
      // ========================================
      
      // 1. Ignora mensagens do próprio bot
      if (messageKey?.fromMe) {
        console.log('⏭️ Ignorando mensagem do bot (fromMe=true)');
        return null;
      }

      // 2. Ignora se userId é o próprio bot
      const botId = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
      if (userId === botId) {
        console.log('⏭️ Ignorando mensagem do próprio bot (userId)');
        return null;
      }

      // 3. Ignora mensagens que já foram processadas (cache simples)
      const messageId = messageKey?.id;
      if (messageId && this.processedMessages.has(messageId)) {
        console.log('⏭️ Mensagem já processada anteriormente');
        return null;
      }

      // ========================================

      if (!from.endsWith('@g.us')) return null;

      const groupId = from;

      // 🔍 Detecta se tem o comando #all damas
      const messageObj = message?.message;
      const hasTextCommand = content?.toLowerCase().includes('#all damas');
      const hasImage = messageObj?.imageMessage;
      const hasVideo = messageObj?.videoMessage;
      const imageCaption = messageObj?.imageMessage?.caption || '';
      const videoCaption = messageObj?.videoMessage?.caption || '';
      const hasImageCommand = imageCaption.toLowerCase().includes('#all damas');
      const hasVideoCommand = videoCaption.toLowerCase().includes('#all damas');

      // Se não tem o comando em lugar nenhum, retorna
      if (!hasTextCommand && !hasImageCommand && !hasVideoCommand) return null;

      // Verifica se o grupo está ativo
      if (this.groups[groupId] && !this.groups[groupId].enabled) return null;

      // 🔐 VERIFICA SE O USUÁRIO É ADMIN
      const isAdmin = await this.isUserAdmin(sock, groupId, userId);
      if (!isAdmin) {
        const styledTitle = "👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸";
        await sock.sendMessage(from, {
          text: `${styledTitle}\n\n🚫 *ACESSO NEGADO*\n\n❌ Apenas administradores podem usar o comando \`#all damas\`!\n\n👨‍💼 Solicite a um admin para marcar o grupo.`
        });
        
        // Marca como processada para não repetir
        if (messageId) {
          this.processedMessages.add(messageId);
        }
        
        return { success: true, processed: true };
      }

      // Atualiza o grupo se necessário
      if (!this.groups[groupId] || this.isGroupOutdated(groupId)) {
        await this.updateGroup(sock, groupId);
      }

      const groupData = this.groups[groupId];
      if (!groupData || !groupData.participants) return null;

      // 🗑️ Remove a mensagem original
      if (messageKey) {
        try {
          console.log('🗑️ Removendo mensagem original...');
          await sock.sendMessage(from, { delete: messageKey });
          console.log('✅ Mensagem original removida!');
        } catch (error) {
          console.error('⚠️ Não foi possível remover mensagem:', error.message);
        }
      }

      const mentions = this.generateMentions(groupData.participants, userId);
      const styledTitle = "👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸";

      // 🖼️ PROCESSA IMAGEM (usando Jimp como no hqseroticos.js)
      if (hasImage && hasImageCommand) {
        console.log('🖼️ Processando mensagem com IMAGEM...');
        const cleanCaption = imageCaption.replace(/#all\s+damas/gi, '').trim();
        const finalCaption = cleanCaption || "💃✨🎉";
        const fullCaption = `${styledTitle}\n\n${finalCaption}`;

        try {
          // Download da imagem
          console.log('📥 Baixando imagem original...');
          const rawBuffer = await downloadMediaMessage(
            message,
            'buffer',
            {},
            { logger: console, reuploadRequest: sock.updateMediaMessage }
          );

          console.log(`📦 Buffer baixado: ${rawBuffer.length} bytes`);

          // Processa com Jimp (mesmo esquema do hqseroticos.js)
          const imageBuffer = await this.processarImagemComJimp(rawBuffer);
          if (!imageBuffer) {
            throw new Error('Falha ao processar imagem com Jimp');
          }

          // Gera thumbnail
          const thumb = await this.gerarThumbnail(imageBuffer, 256);

          // Envia a imagem processada
          await sock.sendMessage(from, {
            image: imageBuffer,
            caption: fullCaption,
            mentions: mentions,
            jpegThumbnail: thumb
          });

          console.log('✅ Imagem reenviada com sucesso!');
          
          // Marca como processada
          if (messageId) {
            this.processedMessages.add(messageId);
          }
          
          this.logAutoTag(userId, groupData.name, 'IMAGEM', fullCaption, mentions.length);
          return { success: true, processed: true };

        } catch (error) {
          console.error('❌ Erro ao processar imagem:', error);
          console.error('Stack:', error.stack);
          await sock.sendMessage(from, {
            text: '❌ Erro ao processar a imagem. Tente novamente.'
          });
          
          // Marca como processada mesmo com erro
          if (messageId) {
            this.processedMessages.add(messageId);
          }
          
          return { success: true, processed: true };
        }
      }

      // 🎥 PROCESSA VÍDEO (✅ CORRIGIDO COM THUMBNAIL)
      if (hasVideo && hasVideoCommand) {
        console.log('🎥 Processando mensagem com VÍDEO...');
        const cleanCaption = videoCaption.replace(/#all\s+damas/gi, '').trim();
        const finalCaption = cleanCaption || "💃✨🎉";
        const fullCaption = `${styledTitle}\n\n${finalCaption}`;

        try {
          console.log('📥 Baixando vídeo original...');
          const videoBuffer = await downloadMediaMessage(
            message,
            'buffer',
            {},
            { logger: console, reuploadRequest: sock.updateMediaMessage }
          );

          console.log(`📦 Vídeo baixado: ${videoBuffer.length} bytes`);

          // ✨ EXTRAI THUMBNAIL DO VÍDEO ORIGINAL
          let jpegThumbnail = null;
          try {
            const videoMessage = messageObj.videoMessage;
            if (videoMessage?.jpegThumbnail) {
              console.log('🖼️ Usando thumbnail original do vídeo');
              jpegThumbnail = videoMessage.jpegThumbnail;
            } else {
              console.log('⚠️ Vídeo não possui thumbnail');
            }
          } catch (thumbError) {
            console.warn('⚠️ Não foi possível extrair thumbnail:', thumbError.message);
          }

          // Envia o vídeo com thumbnail
          await sock.sendMessage(from, {
            video: videoBuffer,
            caption: fullCaption,
            mentions: mentions,
            jpegThumbnail: jpegThumbnail
          });

          console.log('✅ Vídeo reenviado com sucesso!');
          
          // Marca como processada
          if (messageId) {
            this.processedMessages.add(messageId);
          }
          
          this.logAutoTag(userId, groupData.name, 'VÍDEO', fullCaption, mentions.length);
          return { success: true, processed: true };

        } catch (error) {
          console.error('❌ Erro ao processar vídeo:', error);
          console.error('Stack:', error.stack);
          await sock.sendMessage(from, {
            text: '❌ Erro ao processar o vídeo. Tente novamente.'
          });
          
          // Marca como processada mesmo com erro
          if (messageId) {
            this.processedMessages.add(messageId);
          }
          
          return { success: true, processed: true };
        }
      }

      // 📝 PROCESSA TEXTO (comportamento original)
      const cleanMessage = content.replace(/#all\s+damas/gi, '').trim();

      if (!cleanMessage) {
        if (content.trim().toLowerCase() === '#all damas') {
          await sock.sendMessage(from, {
            text: `💡 *Como usar o AutoTag:*\n\n📝 *Texto:* Digite sua mensagem + #all damas\n🖼️ *Imagem:* Envie uma foto com a legenda #all damas\n🎥 *Vídeo:* Envie um vídeo com a legenda #all damas\n\n✨ *Exemplos:*\n\`Festa hoje às 22h #all damas\`\n📸 [Foto] \`Olha essa foto #all damas\`\n🎬 [Vídeo] \`Novo vídeo #all damas\``
          });
          
          // Marca como processada
          if (messageId) {
            this.processedMessages.add(messageId);
          }
          
          return { success: true, processed: true };
        }
      }

      const messageToSend = cleanMessage || "Olá pessoal! 💃✨🎉";
      const finalMessage = `${styledTitle}\n\n${messageToSend}`;

      await sock.sendMessage(from, {
        text: finalMessage,
        mentions: mentions
      });

      // Marca como processada
      if (messageId) {
        this.processedMessages.add(messageId);
      }

      this.logAutoTag(userId, groupData.name, 'TEXTO', finalMessage, mentions.length);
      return { success: true, processed: true };

    } catch (error) {
      console.error('❌ Erro ao processar auto tag:', error);
      console.error('Stack:', error.stack);
      
      // Marca como processada mesmo com erro para evitar loop
      const messageId = messageKey?.id;
      if (messageId) {
        this.processedMessages.add(messageId);
      }
      
      return null;
    }
  }

  logAutoTag(userId, groupName, type, content, mentionsCount) {
    console.log(`\n🏷️ ========= AUTO TAG (${type}) =========`);
    console.log(`👤 Autor: ${userId}`);
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
    if (!content.startsWith('!autotag-')) return false;

    const isAdmin = await this.isUserAdmin(sock, from, userId);
    if (!isAdmin) {
      await sock.sendMessage(from, {
        text: '❌ Apenas administradores podem usar comandos do AutoTag!'
      });
      return true;
    }

    if (content === '!autotag-update') {
      const count = await this.updateGroup(sock, from);
      await sock.sendMessage(from, {
        text: `✅ *GRUPO ATUALIZADO*\n\n📊 ${count} membros encontrados\n🕒 ${new Date().toLocaleString('pt-BR')}\n\n💡 Apenas admins podem usar \`#all damas\``
      });
      return true;
    }

    if (content === '!autotag-status') {
      const status = this.getGroupStatus(from);
      const statusText = `
🏷️ *STATUS DO AUTOTAG*

📊 *Participantes:* ${status.participants}
🔧 *Ativo:* ${status.enabled ? '✅ Sim' : '❌ Não'}
🔐 *Restrição:* 👨‍💼 Apenas Administradores
🕒 *Última Atualização:* ${status.lastUpdated !== 'Nunca' ? new Date(status.lastUpdated).toLocaleString('pt-BR') : 'Nunca'}

*Use !autotag-help para ver comandos*
      `.trim();

      await sock.sendMessage(from, { text: statusText });
      return true;
    }

    if (content === '!autotag-on') {
      await this.toggleGroupStatus(from, true);
      await sock.sendMessage(from, {
        text: '✅ *AUTOTAG ATIVADO*\n\n🔐 Apenas administradores podem usar `#all damas`'
      });
      return true;
    }

    if (content === '!autotag-off') {
      await this.toggleGroupStatus(from, false);
      await sock.sendMessage(from, {
        text: '❌ AutoTag desativado neste grupo!'
      });
      return true;
    }

    if (content === '!autotag-admin-on' || content === '!autotag-admin-off') {
      await sock.sendMessage(from, {
        text: '💡 *INFORMAÇÃO*\n\nO AutoTag agora é sempre restrito para administradores!\n\n🔐 Apenas admins podem usar `#all damas`'
      });
      return true;
    }

    if (content === '!autotag-help') {
      const helpText = `
🏷️ *COMANDOS DO AUTOTAG*

👨‍💼 *Para Administradores:*

📝 *TEXTO:*
\`Sua mensagem #all damas\` - Marca todos

🖼️ *IMAGEM:*
1️⃣ Abra a galeria do WhatsApp
2️⃣ Selecione uma foto
3️⃣ Na legenda, adicione \`#all damas\`
4️⃣ Envie!

🎥 *VÍDEO:*
1️⃣ Selecione um vídeo
2️⃣ Na legenda, adicione \`#all damas\`
3️⃣ Envie!

🔐 *RESTRIÇÃO DE ACESSO*
Apenas administradores podem usar o comando \`#all damas\`

✨ *Exemplos:*
📝 Texto: \`Festa hoje às 22h #all damas\`
🖼️ Imagem: 📸 [Foto] com legenda: \`Olha essa foto #all damas\`
🎥 Vídeo: 🎬 [Vídeo] com legenda: \`Novo vídeo #all damas\`

💃 *Resultado:*
👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸

[Sua mensagem, imagem ou vídeo]

🔔 *Todos os membros recebem notificação automaticamente*

⚠️ *A mensagem original será removida e reenviada com as marcações*
      `.trim();

      await sock.sendMessage(from, { text: helpText });
      return true;
    }

    return false;
  }

  async toggleGroupStatus(groupId, enabled) {
    if (!this.groups[groupId]) this.groups[groupId] = { enabled: true, adminOnly: false };
    this.groups[groupId].enabled = enabled;
    this.saveGroups();
    return enabled;
  }

  async toggleAdminOnly(groupId, adminOnly) {
    if (!this.groups[groupId]) this.groups[groupId] = { enabled: true, adminOnly: false };
    this.groups[groupId].adminOnly = adminOnly;
    this.saveGroups();
    return adminOnly;
  }

  getGroupStatus(groupId) {
    const group = this.groups[groupId];
    return {
      enabled: group?.enabled ?? true,
      adminOnly: true,
      participants: group?.participants?.length ?? 0,
      lastUpdated: group?.lastUpdated ?? 'Nunca'
    };
  }
}

export default AutoTagHandler;