// bot/codigos/handlers/command/perfilHandler.js
import axios from 'axios';
import Jimp from 'jimp';

// ─────────────────────────────────────────────────────────────────────────────
// 👤 SISTEMA DE PERFIL - ESTILO CARTÃO DE MEMBRO
// Uso: #perfil          → exibe seu próprio perfil
//      #perfil @barbara → exibe o perfil de @barbara
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATES_URL =
    'https://raw.githubusercontent.com/lucas-nascimento06/template-perfil/refs/heads/main/templatesperfil.json';

let templatesData = null;

// ── CARREGAMENTO DOS TEMPLATES ────────────────────────────────────────────────

export async function carregarTemplatesPerfil() {
    try {
        console.log('🔄 Carregando templates de perfil...');
        const response = await axios.get(TEMPLATES_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
            timeout: 15000
        });
        templatesData = response.data;
        console.log(`✅ Templates de perfil carregados! (${templatesData.templates?.length || 0} templates)`);
        return true;
    } catch (err) {
        console.error('❌ Erro ao carregar templates de perfil:', err.message);
        throw err;
    }
}

function garantirTemplates() {
    if (!templatesData) throw new Error('Templates não carregados. Chame carregarTemplatesPerfil() primeiro.');
    if (!Array.isArray(templatesData.templates) || templatesData.templates.length === 0) {
        throw new Error('Nenhum template encontrado no JSON.');
    }
}

// ── SORTEAR TEMPLATE ALEATÓRIO E SUBSTITUIR {NOME} ───────────────────────────

function templateAleatorio(nome) {
    garantirTemplates();
    const lista = templatesData.templates;
    const idx = Math.floor(Math.random() * lista.length);
    return lista[idx].replace(/\{NOME\}/g, nome);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

async function gerarThumbnail(buffer, size = 256) {
    try {
        const image = await Jimp.read(buffer);
        image.scaleToFit(size, size);
        return await image.getBufferAsync(Jimp.MIME_JPEG);
    } catch (err) {
        console.error('Erro ao gerar thumbnail:', err);
        return null;
    }
}

async function baixarImagemPoster() {
    const posterUrl = templatesData?.poster_url;
    if (!posterUrl) return null;

    try {
        console.log('🖼️ Baixando poster de perfil...');
        const response = await axios.get(posterUrl, {
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' },
            maxRedirects: 5
        });
        const buffer = Buffer.from(response.data, 'binary');
        if (buffer.length < 1000) return null;
        console.log(`✅ Poster baixado: ${buffer.length} bytes`);
        return buffer;
    } catch (err) {
        console.error('❌ Erro ao baixar poster de perfil:', err.message);
        return null;
    }
}

// ── RESOLVER SENDER REAL (mesma lógica do dedicatoriaHandler) ─────────────────

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

// ── PARSEAR COMANDO ───────────────────────────────────────────────────────────

function parsearComando(content, message) {
    const semPrefixo = content.replace(/^#perfil\s*/i, '').trim();

    // JIDs reais resolvidos pelo WhatsApp (menção com @numero)
    const mentionedJids =
        message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // Nome legível caso venha @barbara (sem número) no texto
    const atMatch = semPrefixo.match(/@(\S+)/);
    const nomeExibicao = atMatch
        ? atMatch[1].replace(/\d+/g, '').trim() || null
        : null;

    return { mentionedJids, nomeExibicao };
}

// ── PROCESSAMENTO PRINCIPAL ───────────────────────────────────────────────────

async function processarPerfil(sock, from, senderId, mentionedJids, nomeExibicao, originalMessage) {
    const numeroRemetente = senderId.split('@')[0];
    const nomeQuemPediu = `@${numeroRemetente}`;

    // ── Resolver alvo ─────────────────────────────────────────────────────────
    // Prioridade: JID real mencionado > nome no texto (@barbara) > próprio remetente
    const destinatarioJid = mentionedJids.length > 0 ? mentionedJids[0] : null;

    const nomeAlvo = destinatarioJid
        ? destinatarioJid.split('@')[0]   // número real da menção
        : (nomeExibicao || numeroRemetente); // nome do @texto ou próprio número

    // Quem será marcado na mensagem
    const allMentions = destinatarioJid
        ? [senderId, destinatarioJid]
        : [senderId];

    const replyContext = {
        stanzaId: originalMessage.key.id,
        participant: originalMessage.key.participant || originalMessage.key.remoteJid,
        quotedMessage: originalMessage.message
    };

    try {
        console.log(`👤 [PERFIL] Gerando perfil para: @${nomeAlvo} (pedido por ${nomeQuemPediu})`);

        // ── 1. SORTEAR E MONTAR O TEMPLATE ────────────────────────────────────
        // O template usa "@{NOME}" — substituímos pelo número real do JID alvo.
        // Assim o WhatsApp reconhece como menção clicável ao encontrar @numero
        // dentro do texto E o JID correspondente no array mentions.
        const jidAlvo = destinatarioJid || senderId;
        const numeroAlvo = jidAlvo.split('@')[0];

        // {NOME} → número real (ex: 5585999999999), ficando "@5585999999999" no texto
        const textoTemplate = templateAleatorio(numeroAlvo);

        // mentions deve conter todos os JIDs que aparecem como @numero no texto
        // → sempre inclui o alvo (quem leva o perfil)
        // → inclui o remetente só se for diferente do alvo (evita duplicata)
        const mentionsFinais = jidAlvo === senderId
            ? [senderId]                      // #perfil → só o próprio
            : [destinatarioJid, senderId];    // #perfil @carol → carol + quem pediu

        // ── 2. TENTAR ENVIAR COM POSTER (se tiver poster_url no JSON) ─────────
        const posterBuffer = await baixarImagemPoster();

        if (posterBuffer) {
            const thumb = await gerarThumbnail(posterBuffer, 256);
            try {
                await sock.sendMessage(from, {
                    image: posterBuffer,
                    caption: textoTemplate,
                    mentions: mentionsFinais,
                    jpegThumbnail: thumb,
                    contextInfo: replyContext
                });
                console.log('✅ [PERFIL] Poster + template enviados!');
                return;
            } catch (e) {
                console.warn('⚠️ [PERFIL] Falha ao enviar imagem, enviando só texto:', e.message);
            }
        }

        // ── 3. FALLBACK: APENAS TEXTO ─────────────────────────────────────────
        await sock.sendMessage(from, {
            text: textoTemplate,
            mentions: mentionsFinais,
            quoted: originalMessage
        });

        console.log('✅ [PERFIL] Template enviado como texto!');

    } catch (err) {
        console.error('❌ [PERFIL] Erro:', err.message);

        const jidAlvoErr = destinatarioJid || senderId;
        const numeroAlvoErr = jidAlvoErr.split('@')[0];

        await sock.sendMessage(from, {
            text: `${nomeQuemPediu}\n\n❌ Não consegui gerar o perfil de @${numeroAlvoErr}. Tente novamente.`,
            mentions: [senderId, jidAlvoErr],
            quoted: originalMessage
        });
    }
}

// ── HANDLERS EXPORTADOS (nomes usados no index/messageHandler) ───────────────

// Uso: await perfilHandler(sock, message)
export async function perfilHandler(sock, message) {
    const from = message.key.remoteJid;
    const content =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text || '';

    const { mentionedJids, nomeExibicao } = parsearComando(content, message);
    const senderId = resolverSenderId(message);

    console.log(`👤 [PERFIL] senderId resolvido: ${senderId}`);

    await processarPerfil(
        sock, from, senderId,
        mentionedJids, nomeExibicao,
        message
    );
}

// Uso: await atualizarPerfilHandler(sock, message)
export async function atualizarPerfilHandler(sock, message) {
    const from = message.key.remoteJid;
    const senderId = resolverSenderId(message);

    await sock.sendMessage(from, {
        text: '🔄 Recarregando templates de perfil do GitHub...',
        mentions: [senderId],
        quoted: message
    });

    try {
        await carregarTemplatesPerfil();
        await sock.sendMessage(from, {
            text: `✅ Templates atualizados! ${templatesData.templates?.length || 0} templates disponíveis.`,
            mentions: [senderId],
            quoted: message
        });
        console.log('✅ [RELOAD PERFIL] Templates recarregados via comando.');
    } catch (err) {
        await sock.sendMessage(from, {
            text: `❌ Erro ao recarregar templates: ${err.message}`,
            mentions: [senderId],
            quoted: message
        });
        console.error('❌ [RELOAD PERFIL] Falha:', err.message);
    }
}

// ── INICIALIZAÇÃO ─────────────────────────────────────────────────────────────

carregarTemplatesPerfil().catch(err =>
    console.error('❌ Erro ao inicializar templates de perfil:', err)
);