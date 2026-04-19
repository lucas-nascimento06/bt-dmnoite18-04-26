import pool from '../../../db.js';
import axios from 'axios';
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURAÇÃO
// ============================================
const CONFIG = {
    URL_POSTER: 'https://raw.githubusercontent.com/LucasNascimento25/audio-regras/main/poster-regras.jpg',
    URL_AUDIOS_JSON: 'https://raw.githubusercontent.com/lucas-nascimento06/audio-regras/refs/heads/main/audios-regras.json',
    DOWNLOAD_TIMEOUT: 30000,
    MAX_RETRIES: 3,
    DELAY_ENTRE_AUDIOS: 2000 // 2 segundos entre cada áudio
};

// ============================================
// FUNÇÕES DE CONVERSÃO DE ÁUDIO (COPIADAS DO CÓDIGO DE BOAS-VINDAS)
// ============================================

/**
 * Converte áudio para Opus
 */
async function converterParaOpus(inputBuffer) {
  return new Promise((resolve) => {
    try {
      const tempDir = path.join(__dirname, "../../../temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const timestamp = Date.now();
      const inputPath = path.join(tempDir, `input_${timestamp}.mp3`);
      const outputPath = path.join(tempDir, `output_${timestamp}.ogg`);

      fs.writeFileSync(inputPath, inputBuffer);

      console.log("🔄 Convertendo para Opus...");

      ffmpeg(inputPath)
        .audioCodec('libopus')
        .audioBitrate('48k')
        .audioChannels(1)
        .audioFrequency(48000)
        .format('ogg')
        .on('error', (err) => {
          console.warn("⚠️ FFmpeg falhou:", err.message);
          try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          } catch (e) {}
          resolve(null);
        })
        .on('end', () => {
          try {
            if (!fs.existsSync(outputPath)) {
              console.warn("⚠️ Arquivo de saída não foi criado");
              fs.unlinkSync(inputPath);
              resolve(null);
              return;
            }

            const audioConvertido = fs.readFileSync(outputPath);
            
            try {
              fs.unlinkSync(inputPath);
              fs.unlinkSync(outputPath);
            } catch (e) {}

            console.log(`✅ Convertido para Opus: ${(audioConvertido.length / 1024).toFixed(2)} KB`);
            resolve(audioConvertido);
          } catch (error) {
            console.error("❌ Erro ao ler arquivo convertido:", error.message);
            resolve(null);
          }
        })
        .save(outputPath);

    } catch (error) {
      console.error("❌ Erro na conversão:", error.message);
      resolve(null);
    }
  });
}

/**
 * Envia áudio PTT com quote
 */
async function enviarAudioPTT(socket, groupId, audioUrl, quotedMessage) {
  try {
    console.log("\n========== ENVIANDO ÁUDIO PTT ==========");
    console.log("📥 Baixando:", audioUrl);
    
    const response = await axios.get(audioUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxContentLength: 10 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'audio/*'
      }
    });
    
    const audioBuffer = Buffer.from(response.data);
    
    if (audioBuffer.length === 0) {
      throw new Error("Buffer vazio");
    }
    
    console.log(`✅ Baixado: ${(audioBuffer.length / 1024).toFixed(2)} KB`);

    const sendOptions = {};
    if (quotedMessage) {
      sendOptions.quoted = quotedMessage;
      console.log("✅ Usando quote na mensagem");
    }

    // Tenta converter para Opus primeiro
    const audioOpus = await converterParaOpus(audioBuffer);

    if (audioOpus) {
      try {
        await socket.sendMessage(groupId, {
          audio: audioOpus,
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true
        }, sendOptions);

        console.log("✅ Áudio PTT (Opus) enviado!");
        console.log("====================================\n");
        return true;
      } catch (err) {
        console.log(`⚠️ Opus falhou: ${err.message}`);
      }
    }

    // Fallback MP3
    try {
      await socket.sendMessage(groupId, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        ptt: true
      }, sendOptions);

      console.log("✅ Áudio PTT (MP3) enviado!");
      console.log("====================================\n");
      return true;
    } catch (err) {
      console.error(`❌ MP3 falhou: ${err.message}`);
    }

    return false;
    
  } catch (error) {
    console.error("❌ Erro ao enviar áudio:", error.message);
    return false;
  }
}

// ============================================
// CARREGAMENTO DE ÁUDIOS
// ============================================

async function carregarAudios() {
  try {
    console.log('🎵 Carregando áudios do JSON...');
    
    const response = await axios.get(CONFIG.URL_AUDIOS_JSON, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    });

    if (!response.data || !response.data.audios) {
      console.error('❌ JSON inválido ou sem campo "audios"');
      return [];
    }

    const audiosAtivos = response.data.audios.filter(audio => audio.ativo === true);
    
    console.log(`✅ ${audiosAtivos.length} áudios ativos carregados`);
    return audiosAtivos;
    
  } catch (error) {
    console.error('❌ Erro ao carregar áudios:', error.message);
    return [];
  }
}

/**
 * Envia todos os áudios fazendo quote do poster
 */
async function sendAudiosComQuoteDoPoster(sock, groupId, audios, posterMessage, userId) {
  if (!audios || audios.length === 0) {
    console.log('⚠️ Nenhum áudio para enviar');
    return;
  }

  console.log(`🎵 Iniciando envio de ${audios.length} áudios...`);

  for (let i = 0; i < audios.length; i++) {
    const audio = audios[i];
    
    try {
      console.log(`\n📤 Enviando áudio ${i + 1}/${audios.length}: ${audio.nome}`);
      
      const sucesso = await enviarAudioPTT(
        sock,
        groupId,
        audio.url,
        posterMessage
      );

      if (sucesso) {
        console.log(`✅ Áudio ${i + 1} enviado com sucesso`);
      } else {
        console.log(`⚠️ Falha ao enviar áudio ${i + 1}`);
      }

      // Aguarda entre áudios (exceto no último)
      if (i < audios.length - 1) {
        console.log(`⏳ Aguardando ${CONFIG.DELAY_ENTRE_AUDIOS}ms antes do próximo áudio...`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_ENTRE_AUDIOS));
      }
      
    } catch (error) {
      console.error(`❌ Erro ao processar áudio ${i + 1}:`, error.message);
    }
  }

  console.log('\n✅ Envio de áudios concluído!');
}

// ============================================
// FUNÇÕES DE BANCO DE DADOS
// ============================================

async function getAdvertencias(userId, groupId) {
  const res = await pool.query(
    'SELECT count FROM advertencias WHERE user_id = $1 AND group_id = $2',
    [userId, groupId]
  );
  return res.rows[0]?.count || 0;
}

async function incrementAdvertencia(userId, groupId) {
  const count = await getAdvertencias(userId, groupId);

  if (count === 0) {
    await pool.query(
      'INSERT INTO advertencias (user_id, group_id, count) VALUES ($1, $2, 1)',
      [userId, groupId]
    );
    return 1;
  } else {
    const newCount = count + 1;
    await pool.query(
      'UPDATE advertencias SET count = $1 WHERE user_id = $2 AND group_id = $3',
      [newCount, userId, groupId]
    );
    return newCount;
  }
}

async function resetAdvertencia(userId, groupId) {
  await pool.query(
    'DELETE FROM advertencias WHERE user_id = $1 AND group_id = $2',
    [userId, groupId]
  );
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

const deleteCommandMessage = async (sock, groupId, messageKey) => {
  const delays = [0, 100, 500, 1000, 2000, 5000];
  
  for (let i = 0; i < delays.length; i++) {
    try {
      if (delays[i] > 0) {
        await new Promise(r => setTimeout(r, delays[i]));
      }
      
      const key = {
        remoteJid: messageKey.remoteJid || groupId,
        fromMe: false,
        id: messageKey.id,
        participant: messageKey.participant
      };
      
      await sock.sendMessage(groupId, { delete: key });
      console.log(`✅ Comando #adv deletado (tentativa ${i + 1})`);
      return true;
    } catch (error) {
      console.log(`❌ Tentativa ${i + 1} de deletar comando falhou`);
    }
  }
  return false;
};

async function sendMessage(sock, chatId, message, senderId) {
  const title = "👏🍻 DﾑMﾑS 💃🔥 Dﾑ NIGӇԵ💃🎶🍾🍸";
  const fullMessage = `${title}\n\n${message}`;
  await sock.sendMessage(chatId, { 
    text: fullMessage, 
    mentions: [senderId] 
  });
}

async function banUser(sock, groupId, userId) {
  await sock.groupParticipantsUpdate(groupId, [userId], 'remove');
}

// ============================================
// DOWNLOAD DO POSTER
// ============================================

function converterParaRawUrl(url) {
    if (!url) return url;
    
    if (url.includes('raw.githubusercontent.com')) {
        return url.replace('/refs/heads/', '/');
    }
    
    if (url.includes('github.com')) {
        return url
            .replace('https://github.com/', 'https://raw.githubusercontent.com/')
            .replace('/blob/', '/');
    }
    
    return url;
}

async function downloadPoster() {
    let tentativa = 0;
    
    while (tentativa < CONFIG.MAX_RETRIES) {
        try {
            tentativa++;
            console.log(`🖼️ Tentando baixar poster (tentativa ${tentativa}/${CONFIG.MAX_RETRIES})...`);
            
            const urlCorrigida = converterParaRawUrl(CONFIG.URL_POSTER);
            console.log(`📎 URL: ${urlCorrigida}`);
            
            const response = await axios.get(urlCorrigida, {
                responseType: 'arraybuffer',
                timeout: CONFIG.DOWNLOAD_TIMEOUT,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'image/jpeg, image/jpg, image/png, image/*',
                    'Cache-Control': 'no-cache'
                },
                maxRedirects: 5,
                validateStatus: (status) => status === 200
            });

            if (!response.data || response.data.byteLength === 0) {
                throw new Error('Buffer vazio recebido');
            }

            console.log(`✅ Poster baixado: ${(response.data.byteLength / 1024).toFixed(2)} KB`);
            return Buffer.from(response.data);

        } catch (error) {
            console.error(`❌ Erro na tentativa ${tentativa}:`, error.message);
            
            if (error.response?.status === 404) {
                console.error('⚠️ ARQUIVO NÃO ENCONTRADO (404)');
                break;
            }
            
            if (tentativa < CONFIG.MAX_RETRIES) {
                console.log(`⏳ Aguardando 2s antes da próxima tentativa...`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }
    
    console.error('❌ Falha ao baixar poster após todas as tentativas');
    return null;
}

// ============================================
// LÓGICA PRINCIPAL DE ADVERTÊNCIAS
// ============================================

async function tratarAdvertencia(sock, groupId, userId) {
  let groupMetadata;
  
  try {
    groupMetadata = await sock.groupMetadata(groupId);
  } catch (err) {
    console.error("Erro ao obter metadados do grupo:", err);
    return;
  }

  const participante = groupMetadata.participants.find(p => p.id === userId);

  if (!participante) {
    await sendMessage(
      sock,
      groupId,
      `O usuário @${userId.split('@')[0]} não está mais neste grupo. Nenhuma advertência aplicada.`,
      userId
    );
    return;
  }

  const count = await incrementAdvertencia(userId, groupId);
  console.log(`Incrementando advertência para ${userId} no grupo ${groupId}. Total: ${count}/3`);

  // ============================================
  // USUÁRIO ATINGIU 3 ADVERTÊNCIAS - BANIR
  // ============================================
  if (count >= 3) {
    await banUser(sock, groupId, userId);
    await sendMessage(
      sock,
      groupId,
      `@${userId.split('@')[0]} completou 3 advertências e foi removido(a) do grupo ❌.

Mesmo após as advertências anteriores, continuou infringindo as regras estabelecidas. O respeito às normas do grupo é fundamental para a convivência de todos.

*Fiquem ligados!!!*`,
      userId
    );
    await resetAdvertencia(userId, groupId);
  } 
  // ============================================
  // USUÁRIO RECEBEU ADVERTÊNCIA (1 ou 2)
  // ============================================
  else {
    console.log(`📢 Processando advertência ${count}/3 para @${userId.split('@')[0]}`);
    
    // 🖼️ TENTA BAIXAR E ENVIAR O POSTER
    const posterBuffer = await downloadPoster();
    let posterMessage = null;
    
    if (posterBuffer) {
      try {
        posterMessage = await sock.sendMessage(groupId, {
          image: posterBuffer,
          caption: `🚨 *@${userId.split('@')[0]}* - ADVERTÊNCIA ${count}/3 ⚠️\n\n` +
                   `𝗩𝗢𝗖𝗘 𝗜𝗡𝗙𝗥𝗜𝗡𝗚𝗜𝗨 𝗨𝗠𝗔 𝗗𝗔𝗦 𝗥𝗘𝗚𝗥𝗔𝗦 𝗗𝗢 𝗚𝗥𝗨𝗣𝗢\n\n` +
                   `⚠️ 𝗔𝗢 𝗔𝗧𝗜𝗡𝗚𝗜𝗥 𝟯 𝗔𝗗𝗩𝗘𝗥𝗧𝗘𝗡𝗖𝗜𝗔𝗦, 𝗩𝗢𝗖𝗘̂ 𝗦𝗘𝗥𝗔 𝗥𝗘𝗠𝗢𝗩𝗜𝗗𝗢\n\n` +
                   `🎵 _Ouça atentamente os áudios das regras abaixo_`,
          mentions: [userId]
        });
        console.log(`✅ Poster da advertência enviado`);
      } catch (error) {
        console.error('❌ Erro ao enviar poster:', error.message);
        posterMessage = null;
      }
    }
    
    // 📝 FALLBACK: Se não conseguiu enviar poster, envia mensagem de texto
    if (!posterMessage) {
      console.log('📝 Enviando mensagem de texto como fallback');
      posterMessage = await sock.sendMessage(groupId, {
        text: `🚨 *@${userId.split('@')[0]}* - 𝗔𝗗𝗩𝗘𝗥𝗧𝗘𝗡𝗖𝗜𝗔 ${count}/3 ⚠️\n\n` +
              `𝗩𝗢𝗖𝗘 𝗜𝗡𝗙𝗥𝗜𝗡𝗚𝗜𝗨 𝗨𝗠𝗔 𝗗𝗔𝗦 𝗥𝗘𝗚𝗥𝗔𝗦 𝗗𝗢 𝗚𝗥𝗨𝗣𝗢\n\n` +
              `⚠️ 𝗔𝗢 𝗔𝗧𝗜𝗡𝗚𝗜𝗥 𝟯 𝗔𝗗𝗩𝗘𝗥𝗧𝗘𝗡𝗖𝗜𝗔𝗦, 𝗩𝗢𝗖𝗘̂ 𝗦𝗘𝗥𝗔 𝗥𝗘𝗠𝗢𝗩𝗜𝗗𝗢\n\n` +
              `🔊 _Ouça atentamente os áudios das regras abaixo para evitar futuras advertências._`,
        mentions: [userId]
      });
    }

    // 🎵 ENVIA TODOS OS ÁUDIOS FAZENDO QUOTE DO POSTER/MENSAGEM
    try {
      console.log('🎵 Carregando e enviando áudios...');
      const audios = await carregarAudios();
      
      if (audios && audios.length > 0) {
        console.log(`🎵 Enviando ${audios.length} áudios para @${userId.split('@')[0]}`);
        
        await sendAudiosComQuoteDoPoster(
          sock, 
          groupId, 
          audios, 
          posterMessage,
          userId
        );
        
        console.log('✅ Todos os áudios foram enviados');
      } else {
        console.warn('⚠️ Nenhum áudio disponível no JSON');
      }
    } catch (error) {
      console.error('❌ Erro ao enviar áudios:', error.message);
      console.error(error.stack);
    }
  }
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

async function handleMessage(sock, message) {
  try {
    const { key, message: msg } = message;
    const from = key.remoteJid;
    const sender = key.participant || key.remoteJid;
    const botId = sock.user.id;

    console.log(`Mensagem recebida de ${sender} no grupo ${from}`);

    // ============================================
    // VERIFICAÇÃO DE COMANDO #adv
    // ============================================
    
    let isAdvCommand = false;

    // Caso 1: #adv em legenda de imagem
    if (msg?.imageMessage?.caption?.includes('#adv')) {
      isAdvCommand = true;
    }

    // Caso 2: #adv em resposta/quote
    if (msg?.extendedTextMessage?.text?.includes('#adv') && 
        msg?.extendedTextMessage?.contextInfo?.participant) {
      isAdvCommand = true;
    }

    // Caso 3: #adv em mensagem normal
    const messageContent = msg?.conversation || msg?.extendedTextMessage?.text;
    if (messageContent) {
      if (/^#adv\s+@/.test(messageContent) || /^@[^\s]+\s+#adv/.test(messageContent)) {
        isAdvCommand = true;
      }
    }

    if (!isAdvCommand) {
      return;
    }

    console.log('🚨 Comando #adv detectado!');

    // ============================================
    // VERIFICAÇÃO DE PERMISSÃO (ADMIN)
    // ============================================

    let isAdmin = false;
    let groupMetadata;
    
    try {
      groupMetadata = await sock.groupMetadata(from);
      isAdmin = groupMetadata.participants.some(
        p => p.id === sender && p.admin
      );
    } catch (err) {
      console.error("Erro ao verificar admin:", err);
    }

    if (!isAdmin) {
      console.log(`⛔ Usuário ${sender} não é admin`);
      await sendMessage(
        sock,
        from,
        `@${sender.split('@')[0]}, você não possui permissão para executar este comando 🚫👨🏻‍✈️.  
Este recurso é exclusivo dos administradores do grupo.`,
        sender
      );
      return;
    }

    console.log('✅ Usuário é admin, processando comando...');

    // Deleta a mensagem de comando
    await deleteCommandMessage(sock, from, key);

    // ============================================
    // PROCESSAMENTO DO COMANDO #adv
    // ============================================

    // Caso 1: #adv em imagem
    if (msg?.imageMessage) {
      const imageCaption = msg.imageMessage.caption;
      if (imageCaption?.includes('#adv')) {
        const imageSender =
          msg.imageMessage.context?.participant ||
          msg.imageMessage.context?.key?.participant ||
          key.participant ||
          key.remoteJid;

        if (imageSender && imageSender !== botId) {
          console.log(`📸 Advertência em imagem para ${imageSender}`);
          await tratarAdvertencia(sock, from, imageSender);
        }
        return;
      }
    }

    // Caso 2: #adv em resposta/quote
    if (msg?.extendedTextMessage) {
      const commentText = msg.extendedTextMessage.text;
      if (commentText?.includes('#adv')) {
        const quotedMessage = msg.extendedTextMessage.contextInfo;
        
        if (quotedMessage?.participant) {
          const originalSender = quotedMessage.participant;

          if (originalSender && originalSender !== botId) {
            console.log(`💬 Advertência em quote para ${originalSender}`);
            
            const originalMessageKey = {
              remoteJid: from,
              fromMe: false,
              id: quotedMessage.stanzaId,
              participant: originalSender
            };
            
            await deleteCommandMessage(sock, from, originalMessageKey);
            await tratarAdvertencia(sock, from, originalSender);
          }
          return;
        }
      }
    }

    // Caso 3: #adv com menção direta
    if (messageContent) {
      // Padrão 1: #adv @usuario
      const pattern1 = /^#adv\s+@([^\s]+)/;
      const match1 = messageContent.match(pattern1);
      
      if (match1) {
        const mentionedUserName = match1[1].trim().toLowerCase();
        const userToWarn = groupMetadata.participants.find(p =>
          p.id.toLowerCase().includes(mentionedUserName.replace(/ /g, ''))
        );

        if (userToWarn && userToWarn.id !== botId) {
          console.log(`👤 Advertência por menção (padrão 1) para ${userToWarn.id}`);
          await tratarAdvertencia(sock, from, userToWarn.id);
        } else {
          console.log('⚠️ Usuário mencionado não encontrado');
        }
        return;
      }

      // Padrão 2: @usuario #adv
      const pattern2 = /^@([^\s]+)\s+#adv/;
      const match2 = messageContent.match(pattern2);
      
      if (match2) {
        const mentionedUserName = match2[1].trim().toLowerCase();
        const userToWarn = groupMetadata.participants.find(p =>
          p.id.toLowerCase().includes(mentionedUserName)
        );

        if (userToWarn && userToWarn.id !== botId) {
          console.log(`👤 Advertência por menção (padrão 2) para ${userToWarn.id}`);
          await tratarAdvertencia(sock, from, userToWarn.id);
        } else {
          console.log('⚠️ Usuário mencionado não encontrado');
        }
        return;
      }
    }

    console.log('⚠️ Comando #adv não correspondeu a nenhum padrão esperado');

  } catch (error) {
    console.error('❌ Erro ao processar mensagem de advertência:', error);
    console.error(error.stack);
  }
}

// ============================================
// EXPORTAÇÃO
// ============================================

export { 
  handleMessage,
  carregarAudios,
  sendAudiosComQuoteDoPoster
};