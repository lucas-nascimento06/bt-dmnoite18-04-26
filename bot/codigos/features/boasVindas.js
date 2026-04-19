import Jimp from "jimp";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ffmpeg from "fluent-ffmpeg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✨ NOVO: Controle de sequência de áudios
let indiceAudioAtual = 0;
let listaAudiosCache = null;
let ultimaAtualizacaoCache = 0;
const TEMPO_CACHE = 5 * 60 * 1000; // 5 minutos

/**
 * Remove asteriscos da descrição
 */
function limparDescricao(desc) {
  if (!desc) return "Não há regras definidas na descrição do grupo.";
  
  let textoLimpo = desc;
  textoLimpo = textoLimpo.replace(/\*/g, '');
  textoLimpo = textoLimpo.replace(/_/g, '');
  textoLimpo = textoLimpo.replace(/~/g, '');
  textoLimpo = textoLimpo.replace(/`/g, '');
  
  return textoLimpo;
}

/**
 * ✨ NOVO: Busca áudio em sequência (não aleatório)
 */
async function buscarAudioSequencial() {
  try {
    const agora = Date.now();
    
    // Atualiza cache se necessário
    if (!listaAudiosCache || (agora - ultimaAtualizacaoCache) > TEMPO_CACHE) {
      console.log("🔄 Atualizando cache de áudios...");
      const jsonUrl = "https://raw.githubusercontent.com/lucas-nascimento06/audio-bt-apresentacao/refs/heads/main/audios-apresentacao.json";
      
      const response = await axios.get(jsonUrl, { timeout: 10000 });
      
      if (!response.data || !response.data.audios || response.data.audios.length === 0) {
        console.error("❌ JSON vazio ou sem áudios");
        return null;
      }
      
      listaAudiosCache = response.data.audios.filter(audio => audio.ativo === true);
      ultimaAtualizacaoCache = agora;
      
      console.log(`✅ Cache atualizado: ${listaAudiosCache.length} áudios ativos`);
    }
    
    if (listaAudiosCache.length === 0) {
      console.error("❌ Nenhum áudio ativo encontrado");
      return null;
    }
    
    // Pega o áudio atual da sequência
    const audioSelecionado = listaAudiosCache[indiceAudioAtual];
    
    console.log(`🎵 Áudio selecionado [${indiceAudioAtual + 1}/${listaAudiosCache.length}]: ${audioSelecionado.nome}`);
    
    // Avança para o próximo (volta ao início se necessário)
    indiceAudioAtual = (indiceAudioAtual + 1) % listaAudiosCache.length;
    
    if (indiceAudioAtual === 0) {
      console.log("🔄 Sequência reiniciada! Voltando ao primeiro áudio.");
    }
    
    return audioSelecionado;
  } catch (error) {
    console.error("❌ Erro ao buscar áudio:", error.message);
    return null;
  }
}

/**
 * Converte áudio para Opus
 */
async function converterParaOpus(inputBuffer) {
  return new Promise((resolve) => {
    try {
      const tempDir = path.join(__dirname, "../../temp");
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
 * Envia áudio respondendo mensagem
 */
async function enviarAudioRespondendoMensagem(socket, groupId, audioUrl, caption, participant, quotedMessage) {
  try {
    console.log("\n========== ENVIANDO ÁUDIO ==========");
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
    } else {
      console.log("⚠️ Enviando sem quote");
    }

    const audioOpus = await converterParaOpus(audioBuffer);

    // Tenta Opus
    if (audioOpus) {
      try {
        await socket.sendMessage(groupId, {
          audio: audioOpus,
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true
        }, sendOptions);

        console.log("✅ Áudio PTT (Opus) enviado!");

        if (caption && participant) {
          await new Promise(resolve => setTimeout(resolve, 800));
          await socket.sendMessage(groupId, {
            text: caption,
            mentions: [participant]
          }, sendOptions);
          console.log("✅ Caption enviada!");
        }

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

      if (caption && participant) {
        await new Promise(resolve => setTimeout(resolve, 800));
        await socket.sendMessage(groupId, {
          text: caption,
          mentions: [participant]
        }, sendOptions);
        console.log("✅ Caption enviada!");
      }

      console.log("====================================\n");
      return true;
    } catch (err) {
      console.error(`❌ MP3 falhou: ${err.message}`);
    }

    return false;
    
  } catch (error) {
    console.error("❌ Erro:", error.message);
    
    try {
      if (caption && participant) {
        await socket.sendMessage(groupId, {
          text: `⚠️ Erro ao enviar áudio.\n\n${caption}`,
          mentions: [participant]
        });
      }
    } catch (e) {}
    
    return false;
  }
}

/**
 * Gera thumbnail
 */
async function gerarThumbnail(buffer, size = 256) {
  try {
    const image = await Jimp.read(buffer);
    await image.resize(size, size);
    return await image.getBufferAsync(Jimp.MIME_PNG);
  } catch (err) {
    console.error("Erro ao gerar thumbnail:", err);
    return null;
  }
}

/**
 * Envia imagem com thumbnail
 */
async function sendImageWithThumbnail(sock, jid, imageBuffer, caption, mentions = []) {
  try {
    // Tenta gerar thumbnail, mas não falha se não conseguir
    let thumb = null;
    try {
      thumb = await gerarThumbnail(imageBuffer, 256);
    } catch (thumbErr) {
      console.warn("⚠️ Não foi possível gerar thumbnail, continuando sem ele:", thumbErr.message);
    }

    const messageOptions = {
      image: imageBuffer,
      caption,
      mentions,
    };

    if (thumb) {
      messageOptions.jpegThumbnail = thumb;
    }

    const mensagem = await sock.sendMessage(jid, messageOptions);
    console.log("✅ Imagem enviada" + (thumb ? " com thumbnail" : " sem thumbnail"));
    return mensagem;
  } catch (err) {
    console.error("❌ Erro ao enviar imagem:", err.message);
    // Fallback para texto
    try {
      const mensagem = await sock.sendMessage(jid, { text: caption, mentions });
      console.log("✅ Enviado como texto (fallback)");
      return mensagem;
    } catch (fallbackErr) {
      console.error("❌ Erro no fallback:", fallbackErr.message);
      return null;
    }
  }
}

/**
 * Envia áudio após boas-vindas
 */
async function enviarAudioAposBoasVindas(socket, groupId, participant, quotedMessage) {
  setTimeout(async () => {
    try {
      console.log("🎵 Enviando áudio após 3s...");
      
      // ✨ MUDANÇA: Usa buscarAudioSequencial ao invés de buscarAudioAleatorio
      const audioData = await buscarAudioSequencial();
      
      if (audioData && audioData.url) {
        const participantName = participant.split("@")[0];
        
        const audioCaption = `
╔═══════════════════════╗
║   🎧 *ÁUDIO IMPORTANTE* 🎧   ║
╚═══════════════════════╝

@${participantName} 👋

🔊 *Por favor, ouça este áudio!*

📢 Mensagem importante sobre:
✅ Propósito do grupo (amizade)
❌ Conteúdo proibido (pornografia)

⚠️ *Ouça com atenção!* 
São apenas alguns segundos! 🎯

🎵 Aperte o ▶️ para ouvir! 🎉
        `.trim();
        
        const audioEnviado = await enviarAudioRespondendoMensagem(
          socket,
          groupId,
          audioData.url,
          audioCaption,
          participant,
          quotedMessage
        );
        
        if (audioEnviado) {
          console.log("✅ Áudio enviado com sucesso!");
        } else {
          console.log("⚠️ Não foi possível enviar o áudio");
        }
      } else {
        console.log("⚠️ Nenhum áudio disponível");
      }
      
    } catch (error) {
      console.error("❌ Erro ao enviar áudio:", error);
    }
  }, 3000);
}

/**
 * Envia regras após 10s
 */
async function enviarRegrasAposDelay(socket, groupId, participant) {
  setTimeout(async () => {
    try {
      console.log("⏰ Enviando regras...");

      const participantName = participant.split("@")[0];
      const groupMetadata = await socket.groupMetadata(groupId);
      
      const regras = limparDescricao(groupMetadata.desc);

      const mensagem = `『🕺🍻 𝐑𝐄𝐆𝐑♞𝐒 ҉ 𝐃♛ ҉ 𝐆𝐑𝐔𝐏♛ 💃🍷』 \n\n@${participantName}, aqui estão as regras:\n\n${regras}\n\n⚠️ *Por favor, leia com atenção e siga todas as orientações!*`;

      await socket.sendMessage(groupId, {
        text: mensagem,
        mentions: [participant],
      });

      console.log("✅ Regras enviadas");
      
    } catch (error) {
      console.error("❌ Erro ao enviar regras:", error);

      try {
        await socket.sendMessage(groupId, {
          text: `@${participant.split("@")[0]}, houve um erro ao carregar as regras.`,
          mentions: [participant],
        });
      } catch (fallbackError) {
        console.error("❌ Erro no fallback:", fallbackError);
      }
    }
  }, 30000);
}

/**
 * Comando !regras
 */
export const processarComandoRegras = async (socket, message) => {
  try {
    const remoteJid = message.key.remoteJid;
    const participant = message.key.participant || message.key.remoteJid;
    
    if (!remoteJid.endsWith('@g.us')) {
      await socket.sendMessage(remoteJid, {
        text: "⚠️ Este comando só funciona em grupos!",
      });
      return;
    }

    console.log("📋 Comando !regras solicitado");

    const participantName = participant.split("@")[0];
    const groupMetadata = await socket.groupMetadata(remoteJid);
    
    const regras = limparDescricao(groupMetadata.desc);

    const mensagem = `『🕺🍻 𝐑𝐄𝐆𝐑♞𝐒 ҉ 𝐃♛ ҉ 𝐆𝐑𝐔𝐏♛ 💃🍷』 \n\n@${participantName}, aqui estão as regras:\n\n${regras}\n\n⚠️ *Por favor, leia com atenção e siga todas as orientações!*`;

    await socket.sendMessage(remoteJid, {
      text: mensagem,
      mentions: [participant],
    });

    console.log("✅ Regras enviadas");
  } catch (error) {
    console.error("❌ Erro ao processar !regras:", error);

    try {
      await socket.sendMessage(message.key.remoteJid, {
        text: "❌ Erro ao buscar as regras do grupo.",
      });
    } catch (fallbackError) {
      console.error("❌ Erro no fallback:", fallbackError);
    }
  }
};

/**
 * Boas-vindas
 */
export const configurarBoasVindas = async (socket, groupId, participant) => {
  try {
    console.log("🎉 Iniciando boas-vindas");

    const participantName = participant.split("@")[0];

    let profilePictureUrl;
    try {
      profilePictureUrl = await socket.profilePictureUrl(participant, "image");
      console.log("✅ Foto obtida");
    } catch (error) {
      console.log("⚠️ Usando foto padrão");
      profilePictureUrl = "https://images2.imgbox.com/a5/a4/gyGTUylB_o.png";
    }

    const welcomeMessages = [
     `🎉💃 *BEM-VINDO(A) AO GRUPO* 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\n@${participantName} ✨🎉\n\n Aqui é um espaço de interação e diversão 24 horas! 🕛🔥 Prepare seu meme, seu GIF e sua risada! 😎💥\n\nParticipe das conversas e aproveite bons momentos com a gente! 💃🎶🍾🍸\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
       `🎊🔥 *CHEGOU O(A) DONO(A) DA FESTA!* 💃🍾 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nPrepare-se para zoeira, desafios e histórias que ninguém acredita! 😎🔥\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💃✨ *A RAINHA OU O REI CHEGOU!* 👑🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nAqui só entra quem gosta de diversão, memes e risadas sem limites! 😆🍹\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎶💥 *CHEGOU COM ESTILO!* 💃🌟 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nSolte o GIF, prepare o emoji e venha causar impacto! 😎💫\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🍾🎊 *BOAS-VINDAS À FESTA MAIS DOIDA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nCuidado: aqui as risadas são contagiosas e os memes, explosivos! 💥😂\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🌈💃 *SEJA MUITO BEM-VINDO(A)!* 🎉🔥 @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nPegue sua bebida, prepare o emoji e bora curtir a bagunça! 🍹😆\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎊🔥 *NOVO(A) INTEGRANTE NA ÁREA!* 💃✨ SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nVai rolar desafio de memes e risadas garantidas, pronto(a) para isso? 😏🔥\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💥🎉 *CHEGOU O(A) MAIS ESPERADO(A)!* 💃🌟 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nTraga seu GIF mais épico, sua risada mais alta e bora agitar! 😎🍸\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🔥🍾 *BEM-VINDO(A)* 💃🎊 @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nAqui é só alegria, memes e histórias pra contar! 😆🎶\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💃🎶 *A ALEGRIA CHEGOU!* 💥✨ SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nPrepare seu GIF, emoji e risadas: a festa começou! 🎊🍹\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎉💫 *ENTRADA VIP DETECTADA!* 💃🍸 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nO tapete vermelho de memes e risadas está pronto, role aí! 😎🔥\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💃🔥 *CHEGOU O(A) DESTRUÍDOR(A) DE TÉDIO!* 🎊✨ SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nPrepare-se para aventuras, risadas e GIFs inesperados! 😏🍾\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎊🍾 *O GRUPO TÁ EM FESTA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nAqui só entra quem gosta de zoeira, memes e bons drinks imaginários! 🍹😂\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💫🔥 *CHEGADA ILUMINADA!* 💃🎶 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nLuz, câmera e muita diversão: seu palco está pronto! 🎉🌟\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🌈🎊 *CHEGANDO COM CHARME E ALEGRIA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nEntre e espalhe boas vibes, memes e GIFs! 😎✨\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💥🎉 *A FESTA AGORA É COMPLETA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nChegou quem faltava pra bagunçar e animar geral! 🎊😂\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🍸🎶 *CHEGOU O(A) NOVO(A) DONO(A) DO ROLE!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nAgora sim a zoeira vai ter chefe! 😎💥\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎉🔥 *MAIS UM(A) PRA BRILHAR COM A GENTE!* 💃🌟 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nTraga suas histórias, risadas e GIFs explosivos! 😆🎊\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💫🎊 *SEJA MUITO BEM-VINDO(A) À BAGUNÇA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nAqui cada risada vale ouro e cada meme é tesouro! 😎💥\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎊💃 *NOVA ENERGIA NO GRUPO!* 💥🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\nChegou quem vai acender ainda mais essa festa! 🍹🎶😆\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎉💃 *CHEGOU O(A) ANIMADOR(A) DA GALERA!* 🔥🍾 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 \n\nPrepare-se para memes, GIFs e muita zoeira! 😎💥\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💥🎊 *A FESTA GANHOU MAIS UM(A)!* 💃🌈 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nSolte seu emoji favorito e venha causar! 😆✨\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🔥💃 *CHEGOU O(A) MESTRE DA ZOEIRA!* 🎉🍹 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nGIFs, memes e risadas ilimitadas te esperam! 😎🎊\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎊✨ *CHEGOU O(A) TURBINADOR(A) DE ALEGRIA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nEntre e solte o riso, a festa começou! 😆💥\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💃🌟 *A DIVERSÃO CHEGOU!* 🎉🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💫🎶 *Dﾑ* *NIGӇԵ* 🍾\n\nPrepare seu GIF mais épico e venha arrasar! 😎🎊\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🍾💥 *O(A) NOVO(A) REI(RAINHA) DA ZOEIRA CHEGOU!* 💃🎉 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nAqui só entra quem ama memes e risadas! 😆✨\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎶🎊 *CHEGOU QUEM VAI AGITAR TUDO!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nGIFs, desafios e histórias inacreditáveis te esperam! 😎💫\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💫💃 *CHEGOU O(A) RESPONSÁVEL PELA ALEGRIA!* 🎉🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nPegue seu emoji e entre na festa! 😆🍾\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎊💥 *A FESTA FICOU COMPLETA!* 💃🎶 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nAqui o meme nunca acaba e a risada é garantida! 😎🎉\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🔥🎉 *CHEGOU O(A) FAZEDOR(A) DE RISADAS!* 💃💫 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nPrepare seu GIF, emoji e venha brilhar! 😆🎊\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🍹💃 *NOVO(A) MEME MASTER NA ÁREA!* 🎉🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nA bagunça só começa agora! 😎💥\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎊✨ *CHEGOU O(A) NOVO(A) CHEFE DA ZOEIRA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nEntre e prepare-se para aventuras e GIFs épicos! 😆🎉\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💥🎶 *O(A) MAIS ANIMADO(A) CHEGOU!* 💃✨ SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nPrepare seu meme e venha causar impacto! 😎🎊\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎉💃 *CHEGOU QUEM VAI AGITAR TUDO!* 💥🌈 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nAqui a diversão é garantida! 😆✨\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💫🔥 *CHEGOU O(A) ILUMINADOR(A) DE RISADAS!* 💃🎊 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nGIFs e histórias épicas estão prontos para você! 😎🎉\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎶💃 *O(A) NOVO(A) DONO(A) DA FESTA!* 💥🌟 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nPrepare-se para risadas e memes sem limites! 😆🎊\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎊✨ *CHEGOU O(A) ANIMADOR(A) DE PRIMEIRA!* 💃🔥 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nEntre e faça sua entrada triunfal com GIFs e emojis! 😎💥\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💥🎉 *O(A) MAIS ESPERADO(A) ESTÁ AQUI!* 💃🌈 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nA festa só fica completa com você! 😆✨\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🔥💫 *NOVO(A) MEME LORD CHEGOU!* 💃🎊 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nPrepare seu emoji e entre na brincadeira! 😎🎉\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎉💃 *A ALEGRIA ESTÁ COMPLETA!* 💥🌟 SEJA BEM-VINDO(A) @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\nTraga sua energia e venha agitar geral! 😆🎊\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎊💥 *ATENÇÃO, CHEGOU O(A) RESPONSÁVEL PELA BAGUNÇA!* 💃🍸 Bem-vindo(a) @${participantName} ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nPrepare os memes e GIFs: agora a festa tá completa! 😎🍹\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💃✨ *O(A) NOVO(A) LENDÁRIO(A) CHEGOU!* 🌟🍾 Olá @${participantName}, entre no grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nAqui cada risada vale ouro, cada meme é uma explosão! 😂🔥\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎉💫 *ALERTA DE DIVERSÃO!* 💃🔥 Bem-vindo(a) @${participantName} ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nSegura o GIF, libera o emoji e venha causar impacto! 😎🎊\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💥🎶 *CHEGOU O(A) CHEFÃO/CHIEF DA ZOEIRA!* 💃🍹 @${participantName}, entre no grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nAqui a regra é: rir até não aguentar mais! 😆🍾\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎊🌟 *BOAS-VINDAS AO(A) DETONADOR(A) DE MEMES!* 💃🎶 @${participantName}, chegou no grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nTraga seu GIF mais épico, a zoeira tá garantida! 😎🎉\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💫🍾 *CHEGOU QUEM VAI AGITAR TUDO!* 💃🎊 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nEntre e espalhe boas vibes, memes e GIFs! 😆🍹\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎶🔥 *OLHA QUEM CHEGOU!* 💃💫 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nPrepare-se: risadas e zoeira sem limites! 😎💥\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💥💃 *CHEGOU O(A) NOVO(A) FENÔMENO!* 🎊🍹 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nGIFs, memes e histórias que ninguém acredita! 😆🎉\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎉🌈 *SE PREPARE!* 💃💫 *O(A) NOVO(A) ALIADO(A) DA ZOEIRA CHEGOU!* @${participantName} 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nEntre com GIF, emoji e muita energia! 😎🎊\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💫🎶 *CHEGOU O(A) SUPREMO(A) DA FESTA!* 💃💥 @${participantName} seja bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nA diversão começa agora: memes e risadas liberadas! 😆🍹\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎊💥 *ATENÇÃO, CHEGOU O(A) NOVO(A) DOMINADOR(A) DE RISADAS!* 💃🎶 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nEntre e prepare seu GIF mais engraçado! 😎🎉\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💃🎉 *OLHA QUEM CHEGOU COM TUDO!* 💥🍾 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nAqui a regra é clara: rir até não aguentar mais! 😆🎊\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎶💫 *SEJA BEM-VINDO(A)* 💃🔥 @${participantName} AO GRUPO 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nPrepare o GIF e venha brilhar na festa! 😎🎊\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🔥🎉 *CHEGOU QUEM VAI AGITAR A GALERA!* 💃✨ @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nTraga seu melhor emoji e GIF para arrasar! 😆🎊\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎊💫 *BOAS-VINDAS AO(A) NOVO(A) IMPACTANTE!* 💃💥 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nAqui só entra quem sabe causar com memes e risadas! 😎🎉\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💥🎶 *OLHA QUEM CHEGOU PRA DOMINAR!* 💃🍾 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nGIFs, desafios e risadas garantidas! 😆✨\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎉💃 *O(A) NOVO(A) FAZEDOR(A) DE RISADAS CHEGOU!* 💥🍹 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nEntre e prepare sua entrada triunfal com GIFs! 😎🎊\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💫🎊 *CHEGOU O(A) NOVO(A) LÍDER DA ZOEIRA!* 💃🔥 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nPrepare-se: memes explosivos e risadas garantidas! 😆🎉\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎶💥 *SE PREPAREM, CHEGOU O(A) NOVO(A) DESTEMIDO(A)!* 💃✨ @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nEntre com GIFs, emojis e muita energia! 😎🎊\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎊💫 *A FESTA AGORA ESTÁ COMPLETA!* 💃🔥 @${participantName}, seja muito bem-vindo(a) ao grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\nPrepare seu GIF e venha brilhar com a galera! 😆🎉\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎉💃 *BOAS-VINDAS*, @${participantName}! Chegou a estrela que vai animar o grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 Prepare seus GIFs e emojis para arrasar! 🎶✨\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💥🎊 *BOAS-VINDAS*, @${participantName}! Agora sim o grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 vai ferver! 😂🍸 Traga sua energia, memes e risadas! 🎉🔥\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎶🌟 *BOAS-VINDAS*, @${participantName}! Entrou quem vai dominar o chat do 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 Solte seu GIF mais épico! 🍾🎊\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💫💃 *BOAS-VINDAS*, @${participantName}! Chegou o(a) novo(a) rei(rainha) da zoeira no 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 Prepare o melhor meme! 🎶✨\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎊💥 *BOAS-VINDAS*, @${participantName}! Agora o grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 tem mais um(a) destruidor(a) de tédio! 😎🍸 GIFs liberados! 🎉💫\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🔥💫 *BOAS-VINDAS*, @${participantName}! Chegou quem vai agitar o 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 com risadas e memes! 😂🍹 Entre e cause impacto! 🎶✨\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎉💃 *BOAS-VINDAS*, @${participantName}! Prepare-se: agora o 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 ficou ainda mais épico! 😆🍾 Traga seus GIFs e emojis favoritos! 🎊🔥\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💫🎶 *BOAS-VINDAS*, @${participantName}! Entrou quem vai dominar o humor no 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 Entre e espalhe risadas! 💃✨\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎊🍾 *BOAS-VINDAS*, @${participantName}! O grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 ganhou mais uma lenda da zoeira! 😎🎉 Prepare seu GIF mais épico! 💫🔥\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💥🎶 *BOAS-VINDAS*, @${participantName}! Chegou quem vai incendiar o 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 com memes e GIFs! 😂🍹 Entre e divirta-se! 🎊✨\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💃🎉 *BOAS-VINDAS*, @${participantName}! Agora a diversão do 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 ficou completa! 😎🍸 Traga seu GIF mais insano! 🎶💫\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎶🔥 *BOAS-VINDAS*, @${participantName}! Chegou quem vai fazer o 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 ferver de risadas! 😂🍾 Solte os emojis e GIFs! 🎉💫\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🥳💥 *BOAS-VINDAS*, @${participantName}! O(a) novo(a) mestre da zoeira chegou no 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸  Prepare-se para risadas épicas! 🎊✨\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎉🍸 *BOAS-VINDAS*, @${participantName}! Agora o 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 ganhou mais uma estrela da diversão! 😎💫 GIFs e memes liberados! 🎶🔥\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💫🎊 *BOAS-VINDAS*, @${participantName}! Entrou no 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 quem vai arrasar com GIFs e risadas! 😂🍾 Entre e cause impacto! 🎉✨\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎶💥 *BOAS-VINDAS*, @${participantName}! Chegou o(a) novo(a) animador(a) do 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸  Prepare seus emojis e memes! 🎊💫\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💃🎉 *BOAS-VINDAS*, @${participantName}! O grupo 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 *acabou de ganhar um(a) destruidor(a) de tédio!* 😂🍸 *Entre e brilhe!* 🎶✨\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `🎊💫 *BOAS-VINDAS*, @${participantName}! Chegou quem vai dominar o 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 com memes e GIFs épicos! 😆🍹 Entre e cause! 🎉🔥\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`,
      `💥🎶 *BOAS-VINDAS*, @${participantName}! Agora o 👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸 está completo com sua presença! 😎🍾 GIFs, memes e diversão liberados! 🎊✨\n\n⏰ *Aguarde 20 segundos que enviarei as regras do grupo!*`
     ];

    const selectedMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

    let mensagemBoasVindas = null;

    if (profilePictureUrl) {
      try {
        const res = await axios.get(profilePictureUrl, {
          responseType: "arraybuffer",
          timeout: 10000,
          maxContentLength: 5 * 1024 * 1024,
        });

        const buffer = Buffer.from(res.data, "binary");

        if (buffer.length > 0) {
          try {
            mensagemBoasVindas = await sendImageWithThumbnail(
              socket,
              groupId,
              buffer,
              selectedMessage,
              [participant]
            );
          } catch (imgErr) {
            console.error("⚠️ Erro ao enviar com thumbnail, tentando sem:", imgErr.message);
            // Tenta enviar direto sem thumbnail
            mensagemBoasVindas = await socket.sendMessage(groupId, {
              image: buffer,
              caption: selectedMessage,
              mentions: [participant],
            });
          }
        } else {
          throw new Error("Buffer vazio");
        }
      } catch (err) {
        console.error("⚠️ Erro ao processar imagem:", err.message);
        mensagemBoasVindas = await socket.sendMessage(groupId, {
          text: selectedMessage,
          mentions: [participant],
        });
      }
    } else {
      mensagemBoasVindas = await socket.sendMessage(groupId, {
        text: selectedMessage,
        mentions: [participant],
      });
    }

    console.log("✅ Boas-vindas enviadas");

    if (mensagemBoasVindas) {
      enviarAudioAposBoasVindas(socket, groupId, participant, mensagemBoasVindas);
    } else {
      console.log("⚠️ Enviando áudio sem quote");
      enviarAudioAposBoasVindas(socket, groupId, participant, null);
    }

    enviarRegrasAposDelay(socket, groupId, participant);
    console.log("⏰ Áudio e regras agendados");
  } catch (error) {
    console.error("❌ Erro nas boas-vindas:", error);

    try {
      await socket.sendMessage(groupId, {
        text: `Bem-vindo(a) @${participant.split("@")[0]} ao grupo! 🎉`,
        mentions: [participant],
      });
    } catch (fallbackError) {
      console.error("❌ Erro crítico:", fallbackError);
    }
  }
};
