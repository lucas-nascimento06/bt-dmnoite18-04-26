// bot/codigos/handlers/command/perfilHandler.js
import axios from 'axios';
import { Jimp, loadFont, HorizontalAlign } from 'jimp';
import { createRequire } from 'module';
import { dirname, resolve } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// 👤 SISTEMA DE PERFIL - ESTILO TROLL COM BARRA DE PORCENTAGEM
// Uso: #perfil          → exibe seu próprio perfil
//      #perfil @nome    → exibe o perfil de @nome
// ─────────────────────────────────────────────────────────────────────────────

const PERFIL_JSON_URL = 'https://raw.githubusercontent.com/lucas-nascimento06/perfil-integrantes-admins/refs/heads/main/perfil-frases.json';

const POSTER_URLS = [
    'https://i.ibb.co/wZzQ1rCB/1.png',
    'https://i.ibb.co/84RzKhsC/2.png',
    'https://i.ibb.co/xt9zypby/3.png',
    'https://i.ibb.co/bj3LXdfS/4.png',
    'https://i.ibb.co/fz0dG5MZ/5.png',
    'https://i.ibb.co/bMwxL8Y5/6.png',
    'https://i.ibb.co/6cCKMh6z/7.png',
    'https://i.ibb.co/pvvGPtz2/8.png',
    'https://i.ibb.co/kVYXT52C/9-copiar.png',
    'https://i.ibb.co/0yVVP69L/10-copiar.png',
];

// ── CAMINHOS DE FONTE (resolvidos uma vez em tempo de importação) ─────────────

const _require   = createRequire(import.meta.url);
const _pluginDir = dirname(_require.resolve('@jimp/plugin-print/package.json'));
const _fontsDir  = resolve(_pluginDir, 'dist/fonts/open-sans');

const FONT_32_WHITE = resolve(_fontsDir, 'open-sans-32-white/open-sans-32-white.fnt');
const FONT_16_WHITE = resolve(_fontsDir, 'open-sans-16-white/open-sans-16-white.fnt');

let perfilData = null;
let _font32    = null;
let _font16    = null;

// ── PRÉ-CARREGAMENTO DAS FONTES ───────────────────────────────────────────────

async function obterFontes() {
    if (_font32 && _font16) return { font32: _font32, font16: _font16 };
    try {
        _font32 = await loadFont(FONT_32_WHITE);
        _font16 = await loadFont(FONT_16_WHITE);
    } catch (err) {
        console.warn('⚠️ [PERFIL] Fontes não carregadas:', err.message);
        _font32 = null;
        _font16 = null;
    }
    return { font32: _font32, font16: _font16 };
}

// ── ADICIONAR TÍTULO NO POSTER ────────────────────────────────────────────────

async function adicionarTituloNoPoster(buffer) {
    try {
        const { font32, font16 } = await obterFontes();
        if (!font32 || !font16) return buffer;

        const image   = await Jimp.read(buffer);
        const W       = image.bitmap.width;
        const FAIXA_H = 105;

        image.scan(0, 0, W, FAIXA_H, (x, y, idx) => {
            image.bitmap.data[idx]     = Math.floor(image.bitmap.data[idx]     * 0.22);
            image.bitmap.data[idx + 1] = Math.floor(image.bitmap.data[idx + 1] * 0.22);
            image.bitmap.data[idx + 2] = Math.floor(image.bitmap.data[idx + 2] * 0.22);
        });

        image.print({
            font:     font32,
            x:        0,
            y:        10,
            text:     { text: 'Detector da Chiquinha', alignmentX: HorizontalAlign.CENTER },
            maxWidth: W
        });

        image.print({
            font:     font16,
            x:        0,
            y:        62,
            text:     { text: 'So Pra Quem Aguenta a Verdade', alignmentX: HorizontalAlign.CENTER },
            maxWidth: W
        });

        console.log('✅ [PERFIL] Título adicionado ao poster.');
        return await image.getBuffer('image/jpeg');
    } catch (err) {
        console.error('❌ [PERFIL] Erro ao adicionar título no poster:', err.message);
        return buffer;
    }
}

// ── CARREGAMENTO DO JSON ────────────────────────────────────────────────────

export async function carregarPerfilData() {
    try {
        console.log('🔄 Carregando dados de perfil...');
        const response = await axios.get(PERFIL_JSON_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
            timeout: 15000
        });
        perfilData = response.data;
        console.log(`✅ Dados de perfil carregados!`);
        console.log(`   📊 Amorosa: ${perfilData.amorosa?.length || 0} frases`);
        console.log(`   📊 Grupo: ${perfilData.grupo?.length || 0} frases`);
        console.log(`   📊 Secreto: ${perfilData.secreto?.length || 0} frases`);
        console.log(`   📊 Gostosura: ${perfilData.gostosura?.length || 0} frases`);
        console.log(`   📊 Diagnóstico: ${perfilData.diagnostico?.length || 0} frases`);
        return true;
    } catch (err) {
        console.error('❌ Erro ao carregar dados de perfil:', err.message);
        throw err;
    }
}

function garantirData() {
    if (!perfilData) throw new Error('Dados não carregados. Chame carregarPerfilData() primeiro.');
}

// ── SORTEAR FRASE ALEATÓRIA DE UMA CATEGORIA ───────────────────────────────

function sortearFrase(categoria) {
    garantirData();
    const lista = perfilData[categoria];
    if (!lista || lista.length === 0) {
        return `⚠️ Categoria "${categoria}" vazia ou não encontrada.`;
    }

    const ativos = lista.filter(item => item.ativo === true);
    if (ativos.length === 0) return `⚠️ Nenhuma frase ativa na categoria "${categoria}".`;

    return ativos[Math.floor(Math.random() * ativos.length)].texto;
}

// ── MONTAR PERFIL COMPLETO ────────────────────────────────────────────────
// CORREÇÃO LID: recebe `nomeExibicao` (o que aparece no texto) separado do
// JID real (que fica apenas em mentions[]). Quando o contato é um LID, o
// nomeExibicao é o apelido digitado pelo usuário (@maria), enquanto o JID
// interno (12036340729997410@lid) vai só para o array de menções do Baileys.

function montarPerfil(nomeExibicao) {
    garantirData();

    const fraseAmorosa     = sortearFrase('amorosa');
    const fraseGrupo       = sortearFrase('grupo');
    const fraseSecreto     = sortearFrase('secreto');
    const fraseGostosura   = sortearFrase('gostosura');
    const fraseDiagnostico = sortearFrase('diagnostico');

    return (
        `𝗗𝗘𝗧𝗘𝗖𝗧𝗢𝗥 𝗗𝗔 𝗖𝗛𝗜𝗤𝗨𝗜𝗡𝗛𝗔 💣: 𝗦𝗼́ 𝗣𝗿𝗮 𝗤𝘂𝗲𝗺 𝗔𝗴𝘂𝗲𝗻𝘁𝗮 𝗮 𝗩𝗲𝗿𝗱𝗮𝗱𝗲\n` +
        `👤 @${nomeExibicao}\n\n` +

        `💔 🅐🅜🅞🅡🅞🅢🅐 :\n` +
        `${fraseAmorosa}\n\n` +

        `👥 🅝🅞 🅖🅡🅤🅟🅞 :\n` +
        `${fraseGrupo}\n\n` +

        `🤫🔍 🅥🅔🅡🅓🅐🅓🅔🅢 :\n` +
        `${fraseSecreto}\n\n` +

        `🥵🔥 🅖🅞🅢🅣🅞🅢🅤🅡🅐 :\n` +
        `${fraseGostosura}\n\n` +

        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🧠🧐 🅓🅘🅐🅖🅝🅞🅢🅣🅘🅒🅞 :\n` +
        `${fraseDiagnostico}`
    );
}

// ── HELPERS ────────────────────────────────────────────────────────────────

async function gerarThumbnail(buffer, size = 256) {
    try {
        const image = await Jimp.read(buffer);
        image.scaleToFit({ w: size, h: size });
        return await image.getBuffer('image/jpeg');
    } catch (err) {
        console.error('Erro ao gerar thumbnail:', err);
        return null;
    }
}

async function baixarImagemPoster() {
    const posterUrl = POSTER_URLS[Math.floor(Math.random() * POSTER_URLS.length)];

    try {
        console.log('🖼️ Baixando poster de perfil...');
        const response = await axios.get(posterUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' },
            maxRedirects: 5
        });
        let buffer = Buffer.from(response.data, 'binary');
        if (buffer.length < 1000) return null;
        console.log(`✅ Poster baixado: ${buffer.length} bytes`);

        buffer = await adicionarTituloNoPoster(buffer);

        return buffer;
    } catch (err) {
        console.error('❌ Erro ao baixar poster:', err.message);
        return null;
    }
}

// ── RESOLVER SENDER REAL ──────────────────────────────────────────────────

function resolverSenderId(message) {
    const key = message.key;
    if (key.participantAlt && key.participantAlt.endsWith('@s.whatsapp.net')) {
        return key.participantAlt;
    }
    if (key.participant && key.participant.endsWith('@s.whatsapp.net')) {
        return key.participant;
    }
    return key.participant || key.remoteJid;
}

// ── PARSEAR COMANDO ──────────────────────────────────────────────────────

function parsearComando(content, message) {
    const semPrefixo = content.replace(/^#perfil\s*/i, '').trim();

    const mentionedJids =
        message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // Captura exatamente o que o usuário digitou após o @, ex: "maria" em "@maria"
    const atMatch = semPrefixo.match(/@(\S+)/);
    const nomeExibicao = atMatch
        ? atMatch[1].replace(/\d+/g, '').trim() || null
        : null;

    return { mentionedJids, nomeExibicao };
}

// ── PROCESSAMENTO PRINCIPAL ──────────────────────────────────────────────

async function processarPerfil(sock, from, senderId, mentionedJids, nomeExibicao, originalMessage) {
    const numeroRemetente = senderId.split('@')[0];

    // ── Resolver JID alvo (usado APENAS em mentions[]) ────────────────────
    const jidAlvo = mentionedJids.length > 0 ? mentionedJids[0] : senderId;

    // ── Resolver nome de exibição (usado APENAS no texto) ─────────────────
    // Prioridade: 1) nomeExibicao digitado pelo usuário (ex: "maria")
    //             2) número extraído do JID quando é um JID normal
    //             3) número do remetente quando é perfil próprio
    //
    // NUNCA usa o JID cru no texto — isso evita "@12036340729997410" quando
    // o contato tem um LID (número interno do WhatsApp).
    let nomeParaTexto;
    if (nomeExibicao) {
        // Usuário digitou @maria → usamos "maria"
        nomeParaTexto = nomeExibicao;
    } else if (mentionedJids.length > 0) {
        // Menção sem nome digitado: tenta extrair número legível do JID.
        // Se for LID (ex: 12036340729997410@lid), vai cair no nomeExibicao
        // que já foi extraído pelo parsearComando — mas como nomeExibicao é
        // null aqui, usamos o número do JID como fallback controlado.
        const jidNum = jidAlvo.split('@')[0];
        nomeParaTexto = jidNum;
    } else {
        // Perfil próprio
        nomeParaTexto = numeroRemetente;
    }

    const nomeQuemPediu = `@${numeroRemetente}`;

    const mentionsFinais = jidAlvo === senderId
        ? [senderId]
        : [jidAlvo, senderId];

    const replyContext = {
        stanzaId:      originalMessage.key.id,
        participant:   originalMessage.key.participant || originalMessage.key.remoteJid,
        quotedMessage: originalMessage.message
    };

    try {
        console.log(`👤 [PERFIL] Gerando perfil para: ${nomeParaTexto} | JID: ${jidAlvo} | pedido por ${nomeQuemPediu}`);

        // Passa o nome de exibição para o texto — JID fica só em mentions[]
        const perfilCompleto = montarPerfil(nomeParaTexto);

        // ── Tentar enviar com poster + título ─────────────────────────────
        const posterBuffer = await baixarImagemPoster();

        if (posterBuffer) {
            const thumb = await gerarThumbnail(posterBuffer, 256);
            try {
                await sock.sendMessage(from, {
                    image:         posterBuffer,
                    caption:       perfilCompleto,
                    mentions:      mentionsFinais,
                    jpegThumbnail: thumb,
                    contextInfo:   replyContext
                });
                console.log('✅ [PERFIL] Poster + perfil enviados!');
                return;
            } catch (e) {
                console.warn('⚠️ [PERFIL] Falha ao enviar imagem, enviando só texto:', e.message);
            }
        }

        // ── Fallback: apenas texto ─────────────────────────────────────────
        await sock.sendMessage(from, {
            text:     perfilCompleto,
            mentions: mentionsFinais,
            quoted:   originalMessage
        });

        console.log('✅ [PERFIL] Perfil enviado como texto!');

    } catch (err) {
        console.error('❌ [PERFIL] Erro:', err.message);

        await sock.sendMessage(from, {
            text:     `${nomeQuemPediu}\n\n❌ Não consegui gerar o perfil de @${nomeParaTexto}. Tente novamente.`,
            mentions: [senderId, jidAlvo],
            quoted:   originalMessage
        });
    }
}

// ── HANDLERS EXPORTADOS ──────────────────────────────────────────────────

export async function perfilHandler(sock, message) {
    const from    = message.key.remoteJid;
    const content =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text || '';

    const { mentionedJids, nomeExibicao } = parsearComando(content, message);
    const senderId = resolverSenderId(message);

    console.log(`👤 [PERFIL] senderId resolvido: ${senderId}`);
    console.log(`👤 [PERFIL] nomeExibicao: ${nomeExibicao} | mentionedJids: ${mentionedJids}`);

    await processarPerfil(
        sock, from, senderId,
        mentionedJids, nomeExibicao,
        message
    );
}

export async function atualizarPerfilHandler(sock, message) {
    const from     = message.key.remoteJid;
    const senderId = resolverSenderId(message);

    await sock.sendMessage(from, {
        text:    '🔄 Recarregando dados de perfil do GitHub...',
        mentions: [senderId],
        quoted:  message
    });

    try {
        await carregarPerfilData();
        await sock.sendMessage(from, {
            text:    `✅ Dados atualizados!\n📊 Carregado com sucesso.`,
            mentions: [senderId],
            quoted:  message
        });
        console.log('✅ [RELOAD PERFIL] Dados recarregados via comando.');
    } catch (err) {
        await sock.sendMessage(from, {
            text:    `❌ Erro ao recarregar dados: ${err.message}`,
            mentions: [senderId],
            quoted:  message
        });
        console.error('❌ [RELOAD PERFIL] Falha:', err.message);
    }
}

// ── INICIALIZAÇÃO ────────────────────────────────────────────────────────

Promise.all([
    carregarPerfilData().catch(err => console.error('❌ Erro ao inicializar dados de perfil:', err)),
    obterFontes()
]);