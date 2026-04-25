// ============================================
// 🎯 COMANDO: #POEMAS / #ATUALIZARPOEMAS
// 📝 FUNÇÃO: Busca poemas do GitHub
// 🔗 FONTE: GitHub JSON
// ============================================

import fetch from 'node-fetch';
import axios from 'axios';
import { Jimp } from 'jimp';

const URL_POEMAS = 'https://raw.githubusercontent.com/lucas-nascimento06/poemas-damas/refs/heads/main/poemas.json';
const FOTO_URL   = 'https://i.ibb.co/7t4msV30/58629ea7-a141-4f18-9f00-99c177f8fa53-1.png';

const TITULO_ELEGANTE = `👏🍻 DﾑMﾑS 💃🔥 Dﾑ NIGӇԵ 💃🎶🍾🍸\n┈──┈˖˚⊹ ⋆♡⋆ ⊹˚˖ ┈──┈`;
const RODAPE_ELEGANTE = `: ・ෆ・┈・┈・⊹*:ꔫ:*˖ ࣪⊹ ・┈・┈・ෆ・ :`;

const negrito = (texto) =>
    texto.split('\n').map(linha => linha.trim() === '' ? '' : `*${linha.replace(/\*/g, '')}*`).join('\n');

let poemasData = null;
let poemasCarregados = false;

// ============================================
// 🔀 SISTEMA DE FILA SEM REPETIÇÃO
// ============================================

let filaPrincipais = [];
let filaRodapes = [];

function embaralhar(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function reconstruirFilas() {
    filaPrincipais = embaralhar(poemasData.frases);
    filaRodapes = embaralhar(poemasData.rodapes);
    console.log(`🔀 Filas reconstruídas: ${filaPrincipais.length} poemas, ${filaRodapes.length} rodapés`);
}

// ============================================
// 🖼️ BAIXAR IMAGEM
// ============================================

async function baixarImagemPoema() {
    try {
        console.log('🖼️ Baixando imagem do poema...');
        const res = await axios.get(FOTO_URL, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(res.data, 'binary');
        console.log(`✅ Imagem baixada: ${buffer.length} bytes`);
        return buffer;
    } catch (error) {
        console.error('❌ Erro ao baixar imagem:', error.message);
        return null;
    }
}

// ============================================
// 🖼️ GERAR THUMBNAIL
// ============================================

async function gerarThumbnail(buffer, size = 256) {
    try {
        const image = await Jimp.read(buffer);
        image.scaleToFit({ w: size, h: size });
        return await image.getBuffer("image/jpeg");
    } catch (err) {
        console.error('Erro ao gerar thumbnail:', err);
        return null;
    }
}

// ============================================
// 📤 ENVIAR IMAGEM COM THUMBNAIL
// ============================================

async function sendMediaWithThumbnail(sock, jid, buffer, caption, mentions = []) {
    try {
        const thumb = await gerarThumbnail(buffer, 256);
        await sock.sendMessage(jid, {
            image: buffer,
            caption,
            mentions,
            jpegThumbnail: thumb
        });
        console.log('✅ Imagem do poema enviada com thumbnail!');
        return true;
    } catch (err) {
        console.error('❌ Erro ao enviar com thumbnail:', err.message);
        try {
            await sock.sendMessage(jid, { image: buffer, caption, mentions });
            console.log('✅ Imagem enviada sem thumbnail (fallback)!');
            return true;
        } catch (err2) {
            console.error('❌ Erro no fallback de imagem:', err2.message);
            return false;
        }
    }
}

// ============================================
// 📥 CARREGAR POEMAS DO GITHUB
// ============================================

async function carregarPoemas() {
    try {
        console.log('🔄 Carregando poemas...');
        const response = await fetch(URL_POEMAS, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        poemasData = {
            frases: data.frases.filter(f => f && f.frase),
            rodapes: data.rodapes
        };

        poemasCarregados = true;
        reconstruirFilas();

        console.log(`✅ ${poemasData.frases.length} poemas carregados!`);
        console.log(`✅ ${poemasData.rodapes.length} rodapés carregados!`);
        return true;
    } catch (error) {
        console.error('❌ Erro ao carregar poemas:', error.message);
        poemasCarregados = false;
        return false;
    }
}

// ============================================
// 👑 VERIFICAR SE É ADMIN DO GRUPO
// ============================================

async function verificarAdmin(sock, jid, userId) {
    try {
        if (!jid.endsWith('@g.us')) return false;
        const groupMetadata = await sock.groupMetadata(jid);
        const participant = groupMetadata.participants.find(p => p.id === userId);
        const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        console.log(`👑 ${userId} é admin: ${isAdmin}`);
        return isAdmin;
    } catch (error) {
        console.error('❌ Erro ao verificar admin:', error);
        return false;
    }
}

// ============================================
// 👥 OBTER PARTICIPANTES DO GRUPO
// ============================================

async function obterParticipantesGrupo(sock, jid) {
    try {
        if (!jid.endsWith('@g.us')) return [];
        const groupMetadata = await sock.groupMetadata(jid);
        const participants = groupMetadata.participants.map(p => p.id);
        console.log(`👥 ${participants.length} participantes encontrados`);
        return participants;
    } catch (error) {
        console.error('❌ Erro ao obter participantes:', error);
        return [];
    }
}

// ============================================
// 🎲 SELECIONAR PRÓXIMO POEMA DA FILA
// ============================================

function getProximoPoema() {
    if (!poemasCarregados || !poemasData || !poemasData.frases || poemasData.frases.length === 0) {
        throw new Error('Poemas não carregados');
    }

    if (filaPrincipais.length === 0) {
        console.log('🔁 Todos os poemas foram enviados! Reiniciando fila embaralhada...');
        filaPrincipais = embaralhar(poemasData.frases);
    }

    if (filaRodapes.length === 0) {
        filaRodapes = embaralhar(poemasData.rodapes);
    }

    const poema = filaPrincipais.shift();
    const rodape = filaRodapes.shift();

    console.log(`📋 Poemas restantes na fila: ${filaPrincipais.length}`);

    return {
        frase: poema.frase.replace(/\*/g, ''),
        rodape: rodape.replace(/\*/g, '')
    };
}

// ============================================
// 📨 COMANDO: #poemas
// ============================================

export async function handlePoemas(sock, message, args, from) {
    try {
        await sock.sendPresenceUpdate('composing', from);

        const senderId = message.key.participant || message.key.remoteJid;

        console.log(`\n👑 ========= #POEMAS =========`);
        console.log(`📱 Grupo: ${from}`);
        console.log(`👤 Enviado por: ${senderId}`);

        const isAdmin = await verificarAdmin(sock, from, senderId);

        // ✅ Apaga a mensagem do comando SEMPRE (admin ou não)
        await sock.sendMessage(from, { delete: message.key });

        if (!isAdmin) {
            console.log(`🚫 [#poemas] Bloqueado: ${senderId} não é admin`);
            return;
        }

        const mentions = await obterParticipantesGrupo(sock, from);

        console.log(`👑 Admin | 👥 Mencionando: ${mentions.length} pessoas`);

        if (!poemasCarregados) {
            await carregarPoemas();
        }

        const { frase, rodape } = getProximoPoema();

        const caption =
            `${negrito(TITULO_ELEGANTE)}\n\n` +
            `📝\n${negrito(frase)}\n\n` +
            `${RODAPE_ELEGANTE}\n\n` +
            `${negrito(rodape)}`;

        const fotoBuffer = await baixarImagemPoema();

        if (fotoBuffer) {
            const enviado = await sendMediaWithThumbnail(sock, from, fotoBuffer, caption, mentions);
            if (!enviado) {
                await sock.sendMessage(from, { text: caption, mentions });
            }
        } else {
            console.log('⚠️ Imagem indisponível, enviando só texto...');
            await sock.sendMessage(from, { text: caption, mentions });
        }

        console.log(`✅ Poema enviado! Admin: ${isAdmin} | Marcados: ${mentions.length}\n`);

    } catch (error) {
        console.error('❌ Erro no #poemas:', error);

        await sock.sendMessage(from, {
            text:
                `${negrito(TITULO_ELEGANTE)}\n\n` +
                `🔧 ${negrito('ESTAMOS MELHORANDO!')} 🔧\n\n` +
                `🌸 ${negrito('Estamos ajustando nossas fontes de inspiração!')} 🌸\n\n` +
                `✨ ${negrito('Em breve retornaremos!')} ✨\n\n` +
                `${RODAPE_ELEGANTE}`
        });
    }
}

// ============================================
// 🔄 COMANDO: #atualizarpoemas
// ============================================

export async function handleAtualizarPoemas(sock, message, args, from) {
    try {
        await sock.sendPresenceUpdate('composing', from);

        const senderId = message.key.participant || message.key.remoteJid;
        const isAdmin = await verificarAdmin(sock, from, senderId);

        console.log(`\n🔄 ========= #ATUALIZARPOEMAS =========`);
        console.log(`📱 Grupo: ${from}`);
        console.log(`👤 Enviado por: ${senderId} | Admin: ${isAdmin}`);

        // ✅ Apaga a mensagem do comando SEMPRE (admin ou não)
        await sock.sendMessage(from, { delete: message.key });

        if (!isAdmin) {
            console.log(`🚫 [#atualizarpoemas] Bloqueado: ${senderId} não é admin`);
            return;
        }

        await sock.sendMessage(from, {
            text:
                `${negrito(TITULO_ELEGANTE)}\n\n` +
                `🔄 ${negrito('Atualizando poemas...')}\n\n` +
                `_Buscando novos poemas no repositório..._\n\n` +
                `${RODAPE_ELEGANTE}`
        });

        poemasCarregados = false;
        const sucesso = await carregarPoemas();

        if (sucesso) {
            await sock.sendMessage(from, {
                text:
                    `${negrito(TITULO_ELEGANTE)}\n\n` +
                    `✅ ${negrito('Poemas atualizados com sucesso!')}\n\n` +
                    `📝 ${negrito(`${poemasData.frases.length} poemas carregados`)}\n` +
                    `🎭 ${negrito(`${poemasData.rodapes.length} rodapés carregados`)}\n\n` +
                    `💡 Use ${negrito('#poemas')} para enviar um poema!\n\n` +
                    `${RODAPE_ELEGANTE}`
            });
            console.log(`✅ Poemas atualizados! ${poemasData.frases.length} poemas, ${poemasData.rodapes.length} rodapés.\n`);
        } else {
            await sock.sendMessage(from, {
                text:
                    `${negrito(TITULO_ELEGANTE)}\n\n` +
                    `❌ ${negrito('Falha ao atualizar!')}\n\n` +
                    `🔧 ${negrito('Não foi possível conectar ao repositório.')}\n` +
                    `⏳ ${negrito('Tente novamente em alguns instantes.')}\n\n` +
                    `${RODAPE_ELEGANTE}`
            });
        }

    } catch (error) {
        console.error('❌ Erro no #atualizarpoemas:', error);

        await sock.sendMessage(from, {
            text:
                `${negrito(TITULO_ELEGANTE)}\n\n` +
                `❌ ${negrito('Erro inesperado!')}\n\n` +
                `🔧 ${negrito(error.message)}\n\n` +
                `${RODAPE_ELEGANTE}`
        });
    }
}

// Inicializar ao carregar o módulo
carregarPoemas().catch(err => console.error('❌ Erro na inicialização:', err));