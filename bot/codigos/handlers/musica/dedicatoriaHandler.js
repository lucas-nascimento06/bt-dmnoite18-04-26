// bot/codigos/dedicatoriaHandler.js
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Jimp, JimpMime } from 'jimp';

import { baixarMusicaBuffer, obterDadosMusica, buscarUrlPorNome } from './download.util.js';

// ─────────────────────────────────────────────────────────────────────────────
// 🎙️ SISTEMA DE DEDICATÓRIA MUSICAL - ESTILO RÁDIO ROMÂNTICA
// ─────────────────────────────────────────────────────────────────────────────

const URL_CONFIG = 'https://raw.githubusercontent.com/lucas-nascimento06/dedicatoria-music-radio-dmng/refs/heads/main/dedicatoria-config.json';

let config = null;
let processandoDedicatoria = false;
const filaDedicatorias = [];

// ── CARREGAMENTO DO CONFIG ───────────────────────────────────────────────────

export async function carregarConfigDedicatoria() {
    try {
        console.log('🔄 Carregando config de dedicatória...');
        const response = await axios.get(URL_CONFIG, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
            timeout: 15000
        });
        config = response.data;
        console.log('✅ Config de dedicatória carregada!');
        return true;
    } catch (err) {
        console.error('❌ Erro ao carregar config dedicatória:', err.message);
        throw err;
    }
}

function garantirConfig() {
    if (!config) throw new Error('Config não carregada. Chame carregarConfigDedicatoria() primeiro.');
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function limparNomeArquivo(nome) {
    return nome.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').substring(0, 100);
}

function formatarDuracao(segundos) {
    if (!segundos) return '0:00';
    const minutos = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${minutos}:${segs.toString().padStart(2, '0')}`;
}

function fraseAleatoria(de, para, musica, artista) {
    garantirConfig();
    const frases = config.frases_romanticas;
    const idx = Math.floor(Math.random() * frases.length);
    return frases[idx].template
        .replace(/{de}/g, de)
        .replace(/{para}/g, para)
        .replace(/{musica}/g, musica)
        .replace(/{artista}/g, artista);
}

function getMensagem(chave, variaveis = {}) {
    garantirConfig();
    let texto = config.mensagens[chave] || '';
    for (const [k, v] of Object.entries(variaveis)) {
        texto = texto.replace(new RegExp(`{${k}}`, 'g'), v);
    }
    return texto;
}

async function gerarThumbnail(buffer, size = 256) {
    try {
        const image = await Jimp.read(buffer);
        image.scaleToFit({ w: size, h: size });
        return await image.getBuffer(JimpMime.jpeg);
    } catch (err) {
        console.error('Erro ao gerar thumbnail:', err);
        return null;
    }
}

// ── FIX: parsearComando limpa @número e @nome do termo ──────────────────────
function parsearComando(content, message) {
    const semPrefixo = content
        .replace(/^#damas\s+(musica|music)\s*/i, '')
        .trim();

    if (!semPrefixo) return null;

    const mentionedJids =
        message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // Captura o nome de exibição ANTES de limpar
    const atMatch = semPrefixo.match(/@(\S+)/);
    const nomeExibicao = atMatch
        ? atMatch[1].replace(/\d+/g, '').trim() || null
        : null;

    // Remove TODAS as menções (@número e @nome) do termo de busca
    const termoLimpo = semPrefixo
        .replace(/@\d+/g, '')   // remove @78263347101865
        .replace(/@\w+/g, '')   // remove @monica, @alguem
        .replace(/\s+/g, ' ')   // normaliza espaços duplos
        .trim();

    console.log(`🧹 [DEDICATÓRIA] Termo limpo: "${termoLimpo}"`);

    if (!termoLimpo) return null;
    return { termo: termoLimpo, mentionedJids, nomeExibicao };
}

async function baixarImagemPoster() {
    garantirConfig();
    try {
        console.log('🖼️ Baixando imagem do poster inicial...');
        const response = await axios.get(config.poster_url, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' },
            maxRedirects: 5
        });
        const buffer = Buffer.from(response.data, 'binary');
        if (buffer.length < 1000) {
            console.warn('⚠️ Poster muito pequeno, ignorando');
            return null;
        }
        console.log(`✅ Poster baixado: ${buffer.length} bytes`);
        return buffer;
    } catch (err) {
        console.error('❌ Erro ao baixar poster:', err.message);
        return null;
    }
}

function extrairVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /\/vi_webp\/([a-zA-Z0-9_-]{11})\//,
        /\/vi\/([a-zA-Z0-9_-]{11})\//,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

async function baixarThumbnail(url) {
    const videoId = extrairVideoId(url);
    const urls = videoId ? [
        `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        url
    ] : [url];

    for (const u of urls) {
        try {
            const response = await axios.get(u, {
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' },
                validateStatus: s => s === 200
            });
            const buf = Buffer.from(response.data);
            if (buf.length < 5000) continue;
            const image = await Jimp.read(buf);
            image.scaleToFit({ w: 1280, h: 720 });
            return await image.getBuffer(JimpMime.jpeg);
        } catch { continue; }
    }
    return null;
}

// ── PROCESSAMENTO PRINCIPAL ──────────────────────────────────────────────────

async function processarDedicatoria(sock, from, termo, senderId, mentionedJids, nomeExibicao, originalMessage) {
    const caminhoTemp = path.join('./downloads', `temp_dedic_${Date.now()}.mp3`);

    // Resolve nomes para exibição
    const nomeQuemPediu = `@${senderId.split('@')[0]}`;
    const destinatarioJid = mentionedJids.length > 0 ? mentionedJids[0] : null;
    const nomeDestinatario = destinatarioJid
        ? `@${destinatarioJid.split('@')[0]}`
        : (nomeExibicao ? `@${nomeExibicao}` : 'você');
    const allMentions = [senderId, ...(destinatarioJid ? [destinatarioJid] : [])];

    // Contexto de reply para referenciar a mensagem original
    const replyContext = {
        stanzaId: originalMessage.key.id,
        participant: originalMessage.key.participant || originalMessage.key.remoteJid,
        quotedMessage: originalMessage.message
    };

    try {
        // ── 1. POSTER INICIAL ────────────────────────────────────────────────
        const posterBuffer = await baixarImagemPoster();
        const captionAviso = getMensagem('aviso_inicial', {
            destinatario: nomeDestinatario,
            remetente: nomeQuemPediu,
            termo
        });

        if (posterBuffer) {
            const thumb = await gerarThumbnail(posterBuffer, 256);
            try {
                await sock.sendMessage(from, {
                    image: posterBuffer,
                    caption: captionAviso,
                    mentions: allMentions,
                    jpegThumbnail: thumb,
                    contextInfo: replyContext   // ← FIX: poster agora responde a mensagem original
                });
                console.log('✅ Poster enviado com reply!');
            } catch (e) {
                console.warn('⚠️ Falha ao enviar poster com imagem, enviando texto:', e.message);
                await sock.sendMessage(from, {
                    text: captionAviso,
                    mentions: allMentions,
                    quoted: originalMessage
                });
            }
        } else {
            await sock.sendMessage(from, {
                text: captionAviso,
                mentions: allMentions,
                quoted: originalMessage
            });
        }

        // ── 2. BUSCA A MÚSICA ────────────────────────────────────────────────
        console.log(`🔍 [DEDICATÓRIA] Buscando: "${termo}"`);
        const urlResult = await buscarUrlPorNome(termo);
        const dados = await obterDadosMusica(urlResult);
        console.log(`🎵 Encontrada: ${dados.titulo} — ${dados.autor}`);

        // ── 3. THUMBNAIL + INFO DA MÚSICA ────────────────────────────────────
        let thumbnailBuffer = null;
        if (dados.thumbnailUrl) thumbnailBuffer = await baixarThumbnail(dados.thumbnailUrl);

        const captionInfo = getMensagem('musica_encontrada', {
            titulo: dados.titulo,
            artista: dados.autor,
            duracao: formatarDuracao(dados.duracao),
            remetente: nomeQuemPediu,
            destinatario: nomeDestinatario
        });

        if (thumbnailBuffer) {
            const thumb = await gerarThumbnail(thumbnailBuffer, 256);
            try {
                await sock.sendMessage(from, {
                    image: thumbnailBuffer,
                    caption: captionInfo,
                    mentions: allMentions,
                    jpegThumbnail: thumb,
                    contextInfo: replyContext
                });
            } catch {
                await sock.sendMessage(from, { text: captionInfo, mentions: allMentions });
            }
        } else {
            await sock.sendMessage(from, { text: captionInfo, mentions: allMentions });
        }

        // ── 4. DOWNLOAD DO ÁUDIO ─────────────────────────────────────────────
        console.log(`⬇️ [DEDICATÓRIA] Baixando áudio...`);
        const result = await baixarMusicaBuffer(urlResult);
        const nomeFormatado = limparNomeArquivo(`${dados.autor} - ${dados.titulo}`);
        const nomeArquivo = `${nomeFormatado}.mp3`;
        const caminhoFinal = path.join('./downloads', nomeArquivo);

        fs.writeFileSync(caminhoTemp, result.buffer);
        if (fs.existsSync(caminhoFinal)) fs.unlinkSync(caminhoFinal);
        fs.renameSync(caminhoTemp, caminhoFinal);

        // ── 5. ENVIA O ÁUDIO ─────────────────────────────────────────────────
        console.log(`📤 [DEDICATÓRIA] Enviando: ${nomeArquivo}`);
        await sock.sendMessage(from, {
            audio: fs.readFileSync(caminhoFinal),
            mimetype: 'audio/mpeg',
            fileName: nomeArquivo,
            ptt: false,
            contextInfo: replyContext
        });

        // ── 6. MENSAGEM ROMÂNTICA FINAL ──────────────────────────────────────
        const nomeDeExibição = senderId.split('@')[0];
        const nomeParaExibição = destinatarioJid
            ? destinatarioJid.split('@')[0]
            : (nomeExibicao || 'você');

        const mensagemRomantica = fraseAleatoria(
            `@${nomeDeExibição}`,
            `@${nomeParaExibição}`,
            dados.titulo,
            dados.autor
        );

        await new Promise(r => setTimeout(r, 800));
        await sock.sendMessage(from, {
            text: mensagemRomantica,
            mentions: allMentions
        });

        if (fs.existsSync(caminhoFinal)) fs.unlinkSync(caminhoFinal);
        console.log(`✅ [DEDICATÓRIA] Concluída!`);

    } catch (err) {
        console.error('❌ [DEDICATÓRIA] Erro:', err.message);
        if (fs.existsSync(caminhoTemp)) fs.unlinkSync(caminhoTemp);

        // Detecta tipo de erro para mensagem adequada
        const chaveErro = err.message?.includes('timeout') ? 'erro_timeout' : 'erro_nao_encontrado';
        const mensagemErro = getMensagem(chaveErro, { termo });

        await sock.sendMessage(from, {
            text: `${nomeQuemPediu}\n\n${mensagemErro}`,
            mentions: [senderId],
            quoted: originalMessage
        });
    }
}

// ── FILA DE PROCESSAMENTO ────────────────────────────────────────────────────

async function processarFila() {
    if (processandoDedicatoria || filaDedicatorias.length === 0) return;
    processandoDedicatoria = true;

    const item = filaDedicatorias.shift();
    try {
        await processarDedicatoria(
            item.sock, item.from, item.termo,
            item.senderId, item.mentionedJids,
            item.nomeExibicao, item.originalMessage
        );
    } catch (err) {
        console.error('Erro na fila de dedicatórias:', err);
    } finally {
        processandoDedicatoria = false;
        if (filaDedicatorias.length > 0) setTimeout(() => processarFila(), 2000);
    }
}

// ── HANDLER PRINCIPAL ────────────────────────────────────────────────────────

export async function handleDedicatoriaCommands(sock, message, from) {
    const content =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text || '';

    if (!/^#damas\s+(musica|music)\s/i.test(content)) return false;

    const temMencaoNoTexto = /@\S+/.test(content);
    const temMencaoResolvida =
        (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length || 0) > 0;

    if (!temMencaoNoTexto && !temMencaoResolvida) return false;

    const parsed = parsearComando(content, message);
    if (!parsed) return false;

    const { termo, mentionedJids, nomeExibicao } = parsed;
    const senderId = message.key.participant || message.key.remoteJid;

    if (!termo) {
        await sock.sendMessage(from, {
            text: getMensagem('uso_comando'),
            mentions: [senderId],
            quoted: message
        });
        return true;
    }

    filaDedicatorias.push({
        sock, from, termo, senderId,
        mentionedJids, nomeExibicao,
        originalMessage: message
    });

    if (filaDedicatorias.length > 1) {
        await sock.sendMessage(from, {
            text: getMensagem('na_fila', { posicao: filaDedicatorias.length }),
            mentions: [senderId],
            quoted: message
        });
    }

    processarFila();
    return true;
}

// Inicialização
carregarConfigDedicatoria().catch(err =>
    console.error('❌ Erro ao inicializar config dedicatória:', err)
);