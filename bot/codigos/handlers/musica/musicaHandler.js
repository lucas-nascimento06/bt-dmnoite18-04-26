// bot/codigos/musicaHandler.js
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import Jimp from 'jimp';
import { baixarMusicaBuffer, obterDadosMusica, buscarUrlPorNome } from './download.util.js';

// Sistema de fila para evitar múltiplas requisições simultâneas
let processandoMusica = false;
const filaMusicas = [];

// Função auxiliar para limpar o nome do arquivo
function limparNomeArquivo(nome) {
    return nome
        .replace(/[<>:"/\\|?*]/g, '') // Remove caracteres inválidos
        .replace(/\s+/g, '_') // Substitui espaços por underscore
        .substring(0, 100); // Limita tamanho
}

// Função para gerar thumbnail com Jimp (mantém proporção original)
async function gerarThumbnail(buffer, size = 256) {
    try {
        const image = await Jimp.read(buffer);
        // Redimensiona mantendo a proporção original (não força quadrado)
        image.scaleToFit(size, size);
        return await image.getBufferAsync(Jimp.MIME_JPEG);
    } catch (err) {
        console.error('Erro ao gerar thumbnail:', err);
        return null;
    }
}

function formatarDuracao(segundos) {
    if (!segundos) return '0:00';
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}:${segs.toString().padStart(2, '0')}`;
}

// Função para extrair videoId do YouTube de uma URL
function extrairVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/, // URLs normais do YouTube
        /\/vi_webp\/([a-zA-Z0-9_-]{11})\//, // Para URLs de thumbnail WebP
        /\/vi\/([a-zA-Z0-9_-]{11})\//, // Para URLs de thumbnail JPG
        /^([a-zA-Z0-9_-]{11})$/ // ID direto
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
            console.log(`✅ VideoID extraído: ${match[1]}`);
            return match[1];
        }
    }

    console.log(`⚠️ Não foi possível extrair VideoID de: ${url}`);
    return null;
}

// Função para gerar URLs alternativas de thumbnail do YouTube
function gerarUrlsThumbnail(url) {
    const videoId = extrairVideoId(url);
    if (!videoId) {
        console.log(`⚠️ Usando URL original: ${url}`);
        return [url]; // Retorna URL original se não for YouTube
    }

    console.log(`🔄 Gerando URLs alternativas para VideoID: ${videoId}`);
    
    // Lista de URLs em ordem de prioridade (do melhor para o pior)
    return [
        `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`, // 1280x720
        `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`, // 640x480
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, // 480x360
        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`, // 320x180
        `https://i.ytimg.com/vi/${videoId}/default.jpg`, // 120x90
        url // URL original como último recurso
    ];
}

// Função para baixar e processar thumbnail com Jimp
async function baixarThumbnailComJimp(url) {
    const urlsParaTestar = gerarUrlsThumbnail(url);
    console.log(`📋 Total de URLs para testar: ${urlsParaTestar.length}`);

    for (let i = 0; i < urlsParaTestar.length; i++) {
        const urlAtual = urlsParaTestar[i];
        
        try {
            console.log(`🖼️ Tentativa ${i + 1}/${urlsParaTestar.length}: ${urlAtual}`);
            
            // Baixa a imagem
            const response = await axios.get(urlAtual, {
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'image/*'
                },
                maxRedirects: 5,
                validateStatus: (status) => status === 200
            });

            const imageBuffer = Buffer.from(response.data);
            console.log(`📦 Buffer baixado: ${imageBuffer.length} bytes`);

            // Valida tamanho mínimo (requer pelo menos 5KB)
            if (imageBuffer.length < 5000) {
                console.log(`⚠️ Imagem muito pequena (${imageBuffer.length} bytes), tentando próxima...`);
                continue;
            }

            // Processa com Jimp para garantir formato compatível
            const image = await Jimp.read(imageBuffer);
            console.log(`📐 Dimensões originais: ${image.getWidth()}x${image.getHeight()}`);

            // Mantém proporção original, apenas limita tamanho máximo
            const maxWidth = 1280;
            const maxHeight = 720;
            
            if (image.getWidth() > maxWidth || image.getHeight() > maxHeight) {
                console.log(`🔧 Redimensionando de ${image.getWidth()}x${image.getHeight()}`);
                // Usa scaleToFit para reduzir mantendo proporção exata
                image.scaleToFit(maxWidth, maxHeight);
                console.log(`✅ Nova dimensão: ${image.getWidth()}x${image.getHeight()}`);
            }

            // Converte para JPEG de alta qualidade
            const processedBuffer = await image
                .quality(90)
                .getBufferAsync(Jimp.MIME_JPEG);

            console.log(`✅ Imagem processada com sucesso: ${processedBuffer.length} bytes (JPEG)`);

            // Valida tamanho máximo (WhatsApp tem limite de ~5MB para imagens)
            if (processedBuffer.length > 5 * 1024 * 1024) {
                console.log(`⚠️ Imagem muito grande, reprocessando...`);
                const smallerBuffer = await image
                    .quality(75)
                    .getBufferAsync(Jimp.MIME_JPEG);
                return smallerBuffer;
            }

            return processedBuffer;

        } catch (error) {
            console.log(`⚠️ Falha na URL ${i + 1}: ${error.message}`);
            // Continua para próxima URL
        }
    }

    console.error('❌ Todas as URLs de thumbnail falharam');
    return null;
}

// Função alternativa: criar thumbnail de placeholder se falhar
async function criarThumbnailPlaceholder(titulo, autor) {
    try {
        console.log(`🎨 Criando thumbnail placeholder...`);
        
        // Cria imagem 800x800 com gradiente
        const image = new Jimp(800, 800, 0x1a1a1aff);

        // Adiciona efeito de gradiente simulado
        for (let y = 0; y < 800; y++) {
            const color = Jimp.rgbaToInt(26 + y / 8, 26 + y / 12, 26 + y / 6, 255);
            for (let x = 0; x < 800; x++) {
                image.setPixelColor(color, x, y);
            }
        }

        // Carrega fonte (usa fonte padrão do Jimp)
        const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
        const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

        // Adiciona ícone musical centralizado (emoji simulado)
        image.print(
            font,
            0,
            320,
            { text: '🎵', alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER },
            800
        );

        // Adiciona título
        const tituloTruncado = titulo.length > 40 ? titulo.substring(0, 37) + '...' : titulo;
        image.print(
            font,
            40,
            400,
            { text: tituloTruncado, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER },
            720
        );

        // Adiciona autor
        const autorTruncado = autor.length > 50 ? autor.substring(0, 47) + '...' : autor;
        image.print(
            fontSmall,
            40,
            450,
            { text: autorTruncado, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER },
            720
        );

        const buffer = await image.quality(85).getBufferAsync(Jimp.MIME_JPEG);
        console.log(`✅ Placeholder criado com sucesso: ${buffer.length} bytes`);
        return buffer;

    } catch (error) {
        console.error('❌ Erro ao criar placeholder:', error.message);
        return null;
    }
}

// ✅ FUNÇÃO CORRIGIDA - Igual ao despedidaMembro.js
async function baixarImagemPoster() {
    try {
        console.log('🖼️ Baixando imagem do poster inicial...');
        const response = await axios.get('https://i.ibb.co/XrWL1ZnG/damas-neon.jpg', {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*'
            },
            maxRedirects: 5
        });
        
        const buffer = Buffer.from(response.data, 'binary');
        console.log(`✅ Imagem do poster baixada: ${buffer.length} bytes`);
        
        // Valida se o buffer não está vazio
        if (buffer.length < 1000) {
            console.error('⚠️ Buffer muito pequeno, pode estar corrompido');
            return null;
        }
        
        return buffer;
    } catch (error) {
        console.error('❌ Erro ao baixar imagem do poster:', error.message);
        console.error('Stack completo:', error.stack);
        return null;
    }
}

// ✅ FUNÇÃO AUXILIAR - Envia mídia com thumbnail (igual despedidaMembro.js)
async function sendMediaWithThumbnail(sock, jid, buffer, caption, mentions = []) {
    try {
        const thumb = await gerarThumbnail(buffer, 256);
        await sock.sendMessage(jid, {
            image: buffer,
            caption,
            mentions,
            jpegThumbnail: thumb
        });
        console.log('✅ Imagem enviada com thumbnail!');
        return true;
    } catch (err) {
        console.error('❌ Erro ao enviar mídia com thumbnail:', err.message);
        // Tenta enviar sem thumbnail como fallback
        try {
            await sock.sendMessage(jid, {
                image: buffer,
                caption,
                mentions
            });
            console.log('✅ Imagem enviada sem thumbnail (fallback)!');
            return true;
        } catch (err2) {
            console.error('❌ Erro ao enviar imagem (fallback):', err2.message);
            return false;
        }
    }
}

// Função para processar a fila
async function processarFila() {
    if (processandoMusica || filaMusicas.length === 0) return;

    processandoMusica = true;
    const { sock, from, termo, senderId, messageKey, originalMessage } = filaMusicas.shift();

    try {
        await baixarEEnviarMusica(sock, from, termo, senderId, messageKey, originalMessage);
    } catch (error) {
        console.error('Erro ao processar música da fila:', error);
    } finally {
        processandoMusica = false;
        // Processa próximo item da fila após 2 segundos
        if (filaMusicas.length > 0) {
            setTimeout(() => processarFila(), 2000);
        }
    }
}

// Função principal de download e envio
async function baixarEEnviarMusica(sock, from, termo, senderId, messageKey, originalMessage) {
    const caminhoCompleto = path.join('./downloads', `temp_${Date.now()}.mp3`);

    try {
        // 🔥 BAIXA E ENVIA IMAGEM DO POSTER COM CAPTION (CORRIGIDO)
        console.log('📸 Iniciando download do poster...');
        const posterBuffer = await baixarImagemPoster();
        
        const captionPoster = `👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\n @${senderId.split('@')[0]}\n\n🎧🎶 𝙿𝚛𝚎𝚙𝚊𝚛𝚊𝚗𝚍𝚘 𝚙𝚊𝚛𝚊 𝚝𝚎 𝚎𝚗𝚝𝚛𝚎𝚐𝚊𝚛 𝚘 𝚑𝚒𝚝 𝚚𝚞𝚎 𝚟𝚊𝚒 𝚏𝚊𝚣𝚎𝚛 𝚝𝚘𝚍𝚘 𝚖𝚞𝚗𝚍𝚘 𝚍𝚊𝚗𝚌̧𝚊𝚛 𝚜𝚎𝚖 𝚙𝚊𝚛𝚊𝚛:  "${termo}"! 🎶💃🕺🔥🎉🍾🎵✨\n\n💡 *𝙳𝙸𝙲𝙰 𝙳𝙴 𝙾𝚄𝚁𝙾:* 🎯\nPara resultados mais precisos, use:\n📝 *#damas music [música - cantor/banda]*\n✨ Exemplo: _#damas music Envolver - Anitta_\n🎪 Assim eu encontro o hit certinho pra você! 🎯🔥`;
        
        if (posterBuffer) {
            console.log('✅ Poster baixado, enviando...');
            // Usa a função auxiliar igual ao despedidaMembro.js
            const enviado = await sendMediaWithThumbnail(
                sock, 
                from, 
                posterBuffer, 
                captionPoster, 
                [senderId]
            );
            
            if (enviado) {
                console.log('✅ Poster enviado com sucesso!');
            } else {
                console.log('⚠️ Falha ao enviar poster, enviando apenas texto...');
                await sock.sendMessage(from, { 
                    text: captionPoster,
                    mentions: [senderId],
                    quoted: originalMessage
                });
            }
        } else {
            console.log('⚠️ Poster não disponível, enviando apenas texto...');
            // Se falhar o download da imagem, envia só texto
            await sock.sendMessage(from, { 
                text: captionPoster,
                mentions: [senderId],
                quoted: originalMessage
            });
        }

        console.log(`🔍 Buscando: ${termo}`);
        const url = await buscarUrlPorNome(termo);

        console.log(`📊 Obtendo dados da música...`);
        const dados = await obterDadosMusica(url);
        console.log(`📄 Dados obtidos: ${dados.titulo} - ${dados.autor}`);
        console.log(`🖼️ URL da thumbnail: ${dados.thumbnailUrl}`);

        // 🎨 PROCESSA E ENVIA THUMBNAIL COM JIMP (COM REPLY)
        let thumbnailEnviada = false;
        if (dados.thumbnailUrl) {
            console.log(`🖼️ Iniciando processamento de thumbnail com Jimp...`);
            
            // Tenta baixar e processar thumbnail original
            let thumbnailBuffer = await baixarThumbnailComJimp(dados.thumbnailUrl);
            
            // Se falhar, cria placeholder
            if (!thumbnailBuffer) {
                console.log(`🎨 Thumbnail original falhou, criando placeholder...`);
                thumbnailBuffer = await criarThumbnailPlaceholder(dados.titulo, dados.autor);
            }

            // Envia a imagem se conseguiu processar
            if (thumbnailBuffer) {
                try {
                    // Gera thumbnail menor (256x256 mantendo proporção)
                    const thumb = await gerarThumbnail(thumbnailBuffer, 256);

                    // Adiciona delay para garantir que a mensagem anterior foi processada
                    await new Promise(resolve => setTimeout(resolve, 500));

                    await sock.sendMessage(from, {
                        image: thumbnailBuffer,
                        caption: `👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸\n\n♫♪♩·.¸¸.·♩♪♫ ෴❤️෴ ෴❤️෴\n🎵 Música: ${dados.titulo} 🎶\n🎤 Artista: ${dados.autor} 🎧\n⏱️ Duração: ${formatarDuracao(dados.duracao)} ⏰\n💃✨ Sinta o ritmo. Brilhe na pista. ✨🕺\n🍾🥂 #NoitePerfeita #DamasDaNight #VibeBoa\n♫♪♩·.¸¸.·♩♪♫ ෴❤️෴ ෴❤️෴\n\n@${senderId.split('@')[0]}\n\n⬇️ 𝙱𝙰𝙸𝚇𝙰𝙽𝙳𝙾 𝚂𝙴𝚄 𝙷𝙸𝚃... 🎧\n💃 𝙿𝚁𝙴𝙿𝙰𝚁𝙰 𝙿𝚁𝙰 𝙳𝙰𝙽𝙲̧𝙰𝚁! 🕺\n🔥 𝙰 𝙵𝙴𝚂𝚃𝙰 𝚅𝙰𝙸 𝙲𝙾𝙼𝙴𝙲̧𝙰𝚁! 🎉`,
                        jpegThumbnail: thumb,
                        mentions: [senderId],
                        contextInfo: {
                            stanzaId: originalMessage.key.id,
                            participant: originalMessage.key.participant || originalMessage.key.remoteJid,
                            quotedMessage: originalMessage.message
                        }
                    });

                    console.log(`✅ Thumbnail enviada com sucesso!`);
                    thumbnailEnviada = true;

                } catch (sendErr) {
                    console.error('❌ Erro ao enviar imagem:', sendErr.message);
                    console.error('Stack:', sendErr.stack);
                }
            }
        } else {
            console.log(`⚠️ Nenhuma URL de thumbnail disponível`);
        }

        // Se não conseguiu enviar thumbnail, envia só texto (COM REPLY)
        if (!thumbnailEnviada) {
            console.log(`📝 Enviando apenas informações de texto...`);
            await sock.sendMessage(from, {
                text: `💃🔥 *DﾑMﾑS Dﾑ NIGӇԵ* 🔥💃\n👏🍻🎶🍾🍸✨\n\n♫♪♩·.¸¸.·♩♪♫ ෴❤️෴ ෴❤️෴\n🎵 Música: ${dados.titulo} 🎶\n🎤 Artista: ${dados.autor} 🎧\n⏱️ Duração: ${formatarDuracao(dados.duracao)} ⏰\n💃✨ Sinta o ritmo. Brilhe na pista. ✨🕺\n🍾🥂 #NoitePerfeita #DamasDaNight #VibeBoa\n♫♪♩·.¸¸.·♩♪♫ ෴❤️෴ ෴❤️෴\n\n@${senderId.split('@')[0]}\n\n⬇️ 𝙱𝙰𝙸𝚇𝙰𝙽𝙳𝙾 𝚂𝙴𝚄 𝙷𝙸𝚃... 🎧\n💃 𝙿𝚁𝙴𝙿𝙰𝚁𝙰 𝙿𝚁𝙰 𝙳𝙰𝙽𝙲̧𝙰𝚁! 🕺\n🔥 𝙰 𝙵𝙴𝚂𝚃𝙰 𝚅𝙰𝙸 𝙲𝙾𝙼𝙴𝙲̧𝙰𝚁! 🎉`,
                mentions: [senderId],
                contextInfo: {
                    stanzaId: originalMessage.key.id,
                    participant: originalMessage.key.participant || originalMessage.key.remoteJid,
                    quotedMessage: originalMessage.message
                }
            });
        }

        console.log(`⬇️ Baixando áudio: ${dados.titulo} - ${dados.autor}`);
        const result = await baixarMusicaBuffer(url);

        // Cria nome do arquivo com título e cantor
        const nomeFormatado = limparNomeArquivo(`${dados.autor} - ${dados.titulo}`);
        const nomeArquivo = `${nomeFormatado}.mp3`;
        const caminhoFinal = path.join('./downloads', nomeArquivo);

        fs.writeFileSync(caminhoCompleto, result.buffer);

        // Renomeia para o nome correto
        if (fs.existsSync(caminhoFinal)) {
            fs.unlinkSync(caminhoFinal);
        }
        fs.renameSync(caminhoCompleto, caminhoFinal);

        console.log(`📤 Enviando áudio: ${nomeArquivo}`);
        console.log(`🔍 DEBUG - originalMessage:`, JSON.stringify(originalMessage.key, null, 2));
        console.log(`🔍 DEBUG - senderId:`, senderId);
        console.log(`🔍 DEBUG - from:`, from);

        // 🎵 ENVIA O ÁUDIO COM REPLY USANDO CONTEXTINFO EXPLÍCITO
        try {
            const sentAudio = await sock.sendMessage(from, {
                audio: fs.readFileSync(caminhoFinal),
                mimetype: 'audio/mpeg',
                fileName: nomeArquivo,
                ptt: false,
                contextInfo: {
                    stanzaId: originalMessage.key.id,
                    participant: originalMessage.key.participant || originalMessage.key.remoteJid,
                    quotedMessage: originalMessage.message
                }
            });

            console.log(`✅ Áudio enviado com contextInfo!`, sentAudio?.key);

        } catch (audioErr) {
            console.error(`❌ ERRO ao enviar áudio com contextInfo:`, audioErr.message);
            console.error(`Stack:`, audioErr.stack);
        }

        // Limpa arquivo após envio
        if (fs.existsSync(caminhoFinal)) {
            fs.unlinkSync(caminhoFinal);
        }

        console.log(`✅ Música enviada com sucesso!`);

    } catch (err) {
        console.error('❌ Erro ao processar música:', err);

        // Limpa arquivo temporário em caso de erro
        if (fs.existsSync(caminhoCompleto)) {
            fs.unlinkSync(caminhoCompleto);
        }

        let mensagemErro = `❌ Ops! Não consegui baixar "${termo}".`;

        if (err.message.includes('EBUSY')) {
            mensagemErro += '\n⏳ O bot está ocupado, tente novamente em alguns segundos.';
        } else if (err.message.includes('No video found')) {
            mensagemErro += '\n🔍 Música não encontrada. Tente com: [música - cantor/banda]';
        } else if (err.message.includes('timeout')) {
            mensagemErro += '\n⏱️ Tempo esgotado. Tente uma música mais curta.';
        }

        await sock.sendMessage(from, {
            text: `@${senderId.split('@')[0]}\n\n${mensagemErro}`,
            mentions: [senderId],
            quoted: originalMessage
        });
    }
}

export async function handleMusicaCommands(sock, message, from) {
    // Extrai o texto da mensagem (igual ao antilink)
    const content = message.message?.conversation || 
                   message.message?.extendedTextMessage?.text || '';
    const lowerContent = content.toLowerCase();

    if (lowerContent.startsWith('#damas music') || lowerContent.startsWith('#damas musica')) {
        const termo = content.replace(/#damas (music|musica)/i, '').trim();
        
        // Extrai o senderId IGUAL ao antilink
        const senderId = message.key.participant || message.key.remoteJid;
        
        // 🔥 CAPTURA A MENSAGEM ORIGINAL COMPLETA PARA FAZER REPLY
        const messageKey = message.key;
        const originalMessage = message;

        console.log(`👤 SenderId extraído: ${senderId}`);
        console.log(`🔑 MessageKey capturada para reply:`, messageKey);

        if (!termo) {
            await sock.sendMessage(from, {
                text: `@${senderId.split('@')[0]}\n\nUso correto: #damas music [música - cantor/banda]`,
                mentions: [senderId],
                quoted: originalMessage
            });
            return true;
        }

        // Adiciona à fila COM a originalMessage
        filaMusicas.push({ sock, from, termo, senderId, messageKey, originalMessage });

        // Se há mais de 1 item na fila, avisa o usuário (COM REPLY)
        if (filaMusicas.length > 1) {
            await sock.sendMessage(from, {
                text: `@${senderId.split('@')[0]}\n\n⏳ Sua música está na fila! Posição: ${filaMusicas.length}\n💃 Aguarde um momento... 🎵`,
                mentions: [senderId],
                quoted: originalMessage
            });
        }

        // Inicia processamento
        processarFila();
        return true;
    }

    return false;
}