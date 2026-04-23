// bot/codigos/handlers/command/saudacoesHandler.js
// ============================================
// 🎯 COMANDOS: #bomdia / #bd | #boatarde / #bt | #boanoite / #bn
// 📝 FUNÇÃO: Busca saudações do GitHub
// 🔗 FONTE: GitHub JSON
// ============================================

import fetch from 'node-fetch';

const URL_SAUDACOES = 'https://raw.githubusercontent.com/lucas-nascimento06/saudacoes-gp/refs/heads/main/saudacoeshandler.json';

// ── Títulos e rodapés por período ──────────────────────────────────────────

const CONFIGS = {
    bom_dia: {
        titulo:  `☀️ 👏🍻 DﾑMﾑS 💃🔥 Dﾑ NIGӇԵ 💃🎶🍾🍸 ☀️\n┈──┈˖˚⊹ ⋆♡⋆ ⊹˚˖ ┈──┈`,
        rodape:  `☀️ © 𝔇𝔞𝔪𝔞𝔰 𝔡𝔞 𝔑𝔦𝔤𝔥𝔱 ☀️`,
        separador: `: ・ෆ・┈・┈・⊹*:ꔫ:*˖ ☀️ ⊹ ・┈・┈・ෆ・ :`,
        chave:   'bom_dia'
    },
    boa_tarde: {
        titulo:  `🌇 👏🍻 DﾑMﾑS 💃🔥 Dﾑ NIGӇԵ 💃🎶🍾🍸 🌇\n┈──┈˖˚⊹ ⋆✴︎˚｡⋆ ⊹˚˖ ┈──┈`,
        rodape:  `🌇 © 𝔇𝔞𝔪𝔞𝔰 𝔡𝔞 𝔑𝔦𝔤𝔥𝔱 🌇`,
        separador: `: ・ෆ・┈・┈・⊹*:ꔫ:*˖ 🌇 ⊹ ・┈・┈・ෆ・ :`,
        chave:   'boa_tarde'
    },
    boa_noite: {
        titulo:  `🌃 👏🍻 DﾑMﾑS 💃🔥 Dﾑ NIGӇԵ 💃🎶🍾🍸 🌃\n: ・ෆ・┈・┈・⊹*:˗ˋˏ ✶ ˎˊ˗:*˖ 🌃 ⊹ ・┈・┈・ෆ・ :`,
        rodape:  `🌃 © 𝔇𝔞𝔪𝔞𝔰 𝔡𝔞 𝔑𝔦𝔤𝔥𝔱 🌃`,
        separador: `.₊̣.̩✧ *̣̩˚̣̣⁺̣‧.₊̣̇.‧⁺̣˚̣̣*̣̩⋆·̩̩.̩̥·̩̩⋆*̣̩˚̣̣⁺̣‧.₊̣̇.‧⁺̣˚̣̣*̣̩ ✧·.̩₊̣
`,
        chave:   'boa_noite'
    }
};

// ── Formatação em negrito ──────────────────────────────────────────────────

const negrito = (texto) =>
    texto.split('\n').map(linha =>
        linha.trim() === '' ? '' : `*${linha.replace(/\*/g, '')}*`
    ).join('\n');

// ── Estado dos dados ───────────────────────────────────────────────────────

let saudacoesData   = null;
let dadosCarregados = false;

// ── Filas sem repetição por período ───────────────────────────────────────

const filas = { bom_dia: [], boa_tarde: [], boa_noite: [] };

function embaralhar(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function reconstruirFila(chave) {
    filas[chave] = embaralhar(saudacoesData[chave]);
    console.log(`🔀 Fila [${chave}] reconstruída: ${filas[chave].length} mensagens`);
}

// ── Carregar JSON do GitHub ────────────────────────────────────────────────

async function carregarSaudacoes() {
    try {
        console.log('🔄 Carregando saudações...');
        const response = await fetch(URL_SAUDACOES, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        saudacoesData = {
            bom_dia:   (data.bom_dia   || []).filter(i => i && i.texto),
            boa_tarde: (data.boa_tarde || []).filter(i => i && i.texto),
            boa_noite: (data.boa_noite || []).filter(i => i && i.texto)
        };

        dadosCarregados = true;

        reconstruirFila('bom_dia');
        reconstruirFila('boa_tarde');
        reconstruirFila('boa_noite');

        console.log(`✅ Saudações carregadas!`);
        console.log(`   ☀️  bom_dia:   ${saudacoesData.bom_dia.length}`);
        console.log(`   🌇 boa_tarde: ${saudacoesData.boa_tarde.length}`);
        console.log(`   🌃 boa_noite: ${saudacoesData.boa_noite.length}`);
        return true;
    } catch (error) {
        console.error('❌ Erro ao carregar saudações:', error.message);
        dadosCarregados = false;
        return false;
    }
}

// ── Próxima mensagem da fila ───────────────────────────────────────────────

function getProximaMensagem(chave) {
    if (!dadosCarregados || !saudacoesData || saudacoesData[chave].length === 0) {
        throw new Error('Saudações não carregadas');
    }

    if (filas[chave].length === 0) {
        console.log(`🔁 Fila [${chave}] reiniciada!`);
        reconstruirFila(chave);
    }

    const item = filas[chave].shift();
    console.log(`📋 [${chave}] Restantes na fila: ${filas[chave].length}`);
    return item.texto.replace(/\*/g, '');
}

// ── Verificar admin ────────────────────────────────────────────────────────

async function verificarAdmin(sock, jid, userId) {
    try {
        if (!jid.endsWith('@g.us')) return false;
        const groupMetadata = await sock.groupMetadata(jid);
        const participant   = groupMetadata.participants.find(p => p.id === userId);
        const isAdmin       = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        console.log(`👑 ${userId} é admin: ${isAdmin}`);
        return isAdmin;
    } catch (error) {
        console.error('❌ Erro ao verificar admin:', error);
        return false;
    }
}

// ── Obter participantes ────────────────────────────────────────────────────

async function obterParticipantes(sock, jid) {
    try {
        if (!jid.endsWith('@g.us')) return [];
        const groupMetadata = await sock.groupMetadata(jid);
        const participants  = groupMetadata.participants.map(p => p.id);
        console.log(`👥 ${participants.length} participantes encontrados`);
        return participants;
    } catch (error) {
        console.error('❌ Erro ao obter participantes:', error);
        return [];
    }
}

// ── Apagar mensagem do comando no grupo ───────────────────────────────────

async function apagarMensagemComando(sock, message, from) {
    try {
        await sock.sendMessage(from, { delete: message.key });
        console.log(`🗑️ Mensagem do comando apagada`);
    } catch (error) {
        console.error('⚠️ Não foi possível apagar a mensagem do comando:', error.message);
    }
}

// ── Handler genérico (usado pelos 3 comandos) ──────────────────────────────

async function handleSaudacao(sock, message, from, tipo) {
    try {
        await sock.sendPresenceUpdate('composing', from);

        const cfg      = CONFIGS[tipo];
        const senderId = message.key.participant || message.key.remoteJid;

        console.log(`\n${cfg.titulo.split('\n')[0]}`);
        console.log(`📱 Grupo: ${from}`);
        console.log(`👤 Enviado por: ${senderId}`);

        const isAdmin  = await verificarAdmin(sock, from, senderId);
        const mentions = isAdmin ? await obterParticipantes(sock, from) : [];

        console.log(`👑 Admin: ${isAdmin} | 👥 Mencionando: ${mentions.length} pessoas`);

        if (!dadosCarregados) {
            await carregarSaudacoes();
        }

        const texto = getProximaMensagem(tipo);

        const mensagem =
            `${negrito(cfg.titulo)}\n\n` +
            `${negrito(texto)}\n\n` +
            `${cfg.separador}\n\n` +
            `${negrito(cfg.rodape)}`;

        // 🗑️ Apaga o comando antes de enviar a saudação
        await apagarMensagemComando(sock, message, from);

        await sock.sendMessage(from, { text: mensagem, mentions });

        console.log(`✅ [${tipo}] enviado! Admin: ${isAdmin} | Marcados: ${mentions.length}\n`);

    } catch (error) {
        console.error(`❌ Erro no handler [${tipo}]:`, error);

        // 🗑️ Tenta apagar mesmo em caso de erro
        await apagarMensagemComando(sock, message, from);

        const cfg = CONFIGS[tipo];

        await sock.sendMessage(from, {
            text:
                `${negrito(cfg.titulo)}\n\n` +
                `🔧 ${negrito('ESTAMOS MELHORANDO!')} 🔧\n\n` +
                `🌸 ${negrito('Em breve retornaremos!')} 🌸\n\n` +
                `${cfg.separador}\n\n` +
                `${negrito(cfg.rodape)}`
        });
    }
}

// ── Exports: #bomdia / #bd ─────────────────────────────────────────────────

export async function handleBomDia(sock, message, args, from) {
    await handleSaudacao(sock, message, from, 'bom_dia');
}

// ── Exports: #boatarde / #bt ───────────────────────────────────────────────

export async function handleBoaTarde(sock, message, args, from) {
    await handleSaudacao(sock, message, from, 'boa_tarde');
}

// ── Exports: #boanoite / #bn ───────────────────────────────────────────────

export async function handleBoaNoite(sock, message, args, from) {
    await handleSaudacao(sock, message, from, 'boa_noite');
}

// ── Exports: #atualizarsaudacoes ───────────────────────────────────────────

export async function handleAtualizarSaudacoes(sock, message, args, from) {
    try {
        await sock.sendPresenceUpdate('composing', from);

        const senderId = message.key.participant || message.key.remoteJid;
        const isAdmin  = await verificarAdmin(sock, from, senderId);

        console.log(`\n🔄 ========= #ATUALIZARSAUDACOES =========`);
        console.log(`📱 Grupo: ${from}`);
        console.log(`👤 Enviado por: ${senderId} | Admin: ${isAdmin}`);

        // 🗑️ Apaga o comando do grupo
        await apagarMensagemComando(sock, message, from);

        if (!isAdmin) {
            await sock.sendMessage(from, {
                text:
                    `${negrito(CONFIGS.boa_noite.titulo)}\n\n` +
                    `🚫 ${negrito('Apenas administradores podem atualizar as saudações!')}\n\n` +
                    `${negrito(CONFIGS.boa_noite.rodape)}`
            });
            return;
        }

        await sock.sendMessage(from, {
            text:
                `🔄 ${negrito('Atualizando saudações...')}\n` +
                `_Buscando mensagens no repositório..._`
        });

        dadosCarregados = false;
        const sucesso = await carregarSaudacoes();

        if (sucesso) {
            await sock.sendMessage(from, {
                text:
                    `✅ ${negrito('Saudações atualizadas com sucesso!')}\n\n` +
                    `☀️ ${negrito(`bom_dia: ${saudacoesData.bom_dia.length} mensagens`)}\n` +
                    `🌇 ${negrito(`boa_tarde: ${saudacoesData.boa_tarde.length} mensagens`)}\n` +
                    `🌃 ${negrito(`boa_noite: ${saudacoesData.boa_noite.length} mensagens`)}\n\n` +
                    `💡 Use ${negrito('#bomdia')} • ${negrito('#boatarde')} • ${negrito('#boanoite')}`
            });
        } else {
            await sock.sendMessage(from, {
                text:
                    `❌ ${negrito('Falha ao atualizar!')}\n\n` +
                    `🔧 ${negrito('Não foi possível conectar ao repositório.')}\n` +
                    `⏳ ${negrito('Tente novamente em alguns instantes.')}`
            });
        }

    } catch (error) {
        console.error('❌ Erro no #atualizarsaudacoes:', error);
        await sock.sendMessage(from, {
            text: `❌ ${negrito('Erro inesperado!')}\n🔧 ${negrito(error.message)}`
        });
    }
}

// ── Inicializar ao carregar o módulo ──────────────────────────────────────

carregarSaudacoes().catch(err => console.error('❌ Erro na inicialização:', err));