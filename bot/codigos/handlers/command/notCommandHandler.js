// bot/codigos/handlers/command/notCommandHandler.js
//
// 🎯 COMANDO #not
//
// USO: Admin responde a uma mensagem inapropriada com #not
//
// O bot irá:
//   1. Verificar se quem enviou #not é admin
//   2. Identificar o autor da mensagem citada (suporta LID)
//   3. Apagar o comando #not do admin
//   4. Apagar a mensagem inapropriada (com múltiplas tentativas)
//   5. Registrar infração no banco
//   6. Punir o infrator (aviso ou remoção + blacklist automática)
//   7. Dar feedback ao admin

import pool from '../../../../db.js';
import { addToBlacklist } from '../../moderation/blacklist/blacklistFunctions.js';
const query = (text, params) => pool.query(text, params);
const DEBUG_MODE = process.env.DEBUG === 'true';

// ============================================
// 💬 MENSAGENS PARA O INFRATOR
// ============================================
const AVISO_INFRATOR_1 = `⚠️ *[AVISO - CONTEÚDO REMOVIDO]*

Olá! Uma mensagem sua foi removida pelo administrador do grupo.

🚫 *Não é permitido enviar:*
- Figurinhas/imagens com conteúdo sexual
- Fotos ou vídeos inapropriados
- Conteúdo ofensivo, terrorista ou violento

Esta é sua *1ª advertência*. Se reincedir, você será removido automaticamente do grupo.`;

const AVISO_INFRATOR_2 = `🚨 *[REMOVIDO DO GRUPO]*

Você foi *removido do grupo* por reincidência no envio de conteúdo inapropriado.

Você já havia recebido um aviso e mesmo assim voltou a enviar conteúdo que viola nossas regras.

Se acredita que foi um engano, entre em contato com um administrador.`;

// ============================================
// 💬 MENSAGENS PARA O ADMIN
// ============================================
const FEEDBACK_ADMIN_1 = (numeroInfrator) =>
`✅ *[AÇÃO REGISTRADA — #not]*

O usuário *+${numeroInfrator}* foi notificado no privado sobre a remoção do conteúdo.

📋 Esta é a *1ª advertência* dele. Caso reincida e você use *#not* novamente, ele será *removido automaticamente* do grupo.`;

const FEEDBACK_ADMIN_2 = (numeroInfrator) =>
`🚨 *[USUÁRIO REMOVIDO — #not]*

O usuário *+${numeroInfrator}* foi *removido automaticamente* do grupo por reincidência e *adicionado à blacklist* 🛑

Esta era a 2ª (ou mais) infração registrada para esse usuário neste grupo.
Se ele tentar entrar novamente, será removido automaticamente.`;

const ERRO_NAO_E_RESPOSTA = `⚠️ *[#not — USO INCORRETO]*

Para usar o *#not*, você precisa *responder* a mensagem inapropriada.

📌 *Como usar:*
1. Toque e segure na mensagem inapropriada
2. Selecione *"Responder"*
3. Digite *#not* e envie`;

const ERRO_NAO_E_ADMIN = `⛔ Apenas administradores podem usar o comando *#not*.`;

const ERRO_NAO_HA_INFRATOR = `⚠️ *[#not — ERRO]*

Não consegui identificar o autor da mensagem citada.
Isso pode ocorrer quando o usuário não está mais no grupo ou o WhatsApp não forneceu os dados.`;

// ============================================
// 🗄️ BANCO DE DADOS
// ============================================
export async function criarTabelaInfracoes() {
    await query(
        `CREATE TABLE IF NOT EXISTS infracoes_mensagens (
            id            SERIAL PRIMARY KEY,
            numero        TEXT      NOT NULL,
            grupo_id      TEXT      NOT NULL,
            tipo_conteudo TEXT      NOT NULL,
            criado_em     TIMESTAMP NOT NULL DEFAULT NOW()
        )`
    );
    console.log("🗄️ Tabela infracoes_mensagens verificada/criada.");
}

async function registrarInfracao(numero, grupoId, tipoConteudo) {
    await query(
        `INSERT INTO infracoes_mensagens (numero, grupo_id, tipo_conteudo)
         VALUES ($1, $2, $3)`,
        [numero, grupoId, tipoConteudo]
    );
}

async function contarInfracoes(numero, grupoId) {
    const result = await query(
        `SELECT COUNT(*) as total FROM infracoes_mensagens
         WHERE numero = $1 AND grupo_id = $2`,
        [numero, grupoId]
    );
    return parseInt(result.rows[0]?.total ?? '0', 10);
}

// ============================================
// 🔧 HELPERS
// ============================================
function extrairNumero(jid) {
    if (!jid) return null;
    return jid.split('@')[0].split(':')[0];
}

function detectarTipoConteudo(quotedMsg) {
    if (!quotedMsg)                          return 'desconhecido';
    if (quotedMsg.stickerMessage)            return 'figurinha';
    if (quotedMsg.imageMessage)              return 'foto';
    if (quotedMsg.videoMessage)              return 'video';
    if (quotedMsg.audioMessage)              return 'audio';
    if (quotedMsg.documentMessage)           return 'documento';
    if (quotedMsg.conversation ||
        quotedMsg.extendedTextMessage)       return 'texto';
    return 'desconhecido';
}

async function enviarMensagem(sock, jid, texto) {
    try {
        await sock.sendMessage(jid, { text: texto });
    } catch (err) {
        console.error(`❌ Falha ao enviar para +${extrairNumero(jid)}, tentando em 3s:`, err.message);
        await new Promise(r => setTimeout(r, 3000));
        try {
            await sock.sendMessage(jid, { text: texto });
        } catch (err2) {
            console.error(`❌ Falha definitiva ao enviar para +${extrairNumero(jid)}:`, err2.message);
        }
    }
}

// ============================================
// 🗑️ DELETE COM MÚLTIPLAS TENTATIVAS
// ============================================
const DELAYS_DELETE = [0, 100, 500, 1000, 2000, 5000];

async function deletarMensagem(sock, grupoId, id, participant) {
    for (let i = 0; i < DELAYS_DELETE.length; i++) {
        try {
            if (DELAYS_DELETE[i] > 0) await new Promise(r => setTimeout(r, DELAYS_DELETE[i]));
            await sock.sendMessage(grupoId, {
                delete: {
                    remoteJid:   grupoId,
                    fromMe:      false,
                    id,
                    participant,
                }
            });
            console.log(`✅ [DELETE] Mensagem deletada (tentativa ${i + 1})`);
            return true;
        } catch (err) {
            if (i === DELAYS_DELETE.length - 1) {
                console.log(`⚠️ [DELETE] Não foi possível deletar após ${DELAYS_DELETE.length} tentativas: ${err.message}`);
            }
        }
    }
    return false;
}

// ============================================
// 🔧 RESOLVE LID → número real
// ============================================
async function resolverLid(sock, lidJid, grupoId) {
    try {
        const metadata = await sock.groupMetadata(grupoId);

        for (const p of metadata.participants) {
            const pLid = p.lid
                ? (typeof p.lid === 'string' ? p.lid : p.lid?.toString?.() ?? '')
                : '';

            if (p.id === lidJid || pLid === lidJid) {
                if (p.phoneNumber) {
                    const phoneJid = p.phoneNumber.includes('@')
                        ? p.phoneNumber
                        : `${p.phoneNumber}@s.whatsapp.net`;
                    console.log(`🔍 LID resolvido: ${extrairNumero(lidJid)} → +${extrairNumero(phoneJid)}`);
                    return phoneJid;
                }
                if (p.id && !p.id.includes('@lid')) {
                    console.log(`🔍 LID resolvido via .id: ${extrairNumero(lidJid)} → +${extrairNumero(p.id)}`);
                    return p.id;
                }
            }
        }

        console.log(`⚠️ LID não resolvido: ${lidJid}`);
        return null;
    } catch (err) {
        console.error(`❌ Erro ao resolver LID:`, err.message);
        return null;
    }
}

// ============================================
// 🔧 OBTÉM JID REAL A PARTIR DE RAW (string ou objeto)
// ============================================
async function obterJidReal(sock, raw, grupoId) {
    if (!raw) return null;

    if (typeof raw === 'object') {
        if (raw.phoneNumber) {
            return raw.phoneNumber.includes('@')
                ? raw.phoneNumber
                : `${raw.phoneNumber}@s.whatsapp.net`;
        }
        if (raw.id && !raw.id.includes('@lid')) return raw.id;
        if (raw.id) return await resolverLid(sock, raw.id, grupoId);
        return null;
    }

    if (raw.includes('@s.whatsapp.net')) return raw;
    if (raw.includes('@lid'))            return await resolverLid(sock, raw, grupoId);
    return raw;
}

// ============================================
// 🔧 VERIFICA SE JID É ADMIN DO GRUPO
// ============================================
async function isAdmin(sock, jid, grupoId) {
    if (!jid) return false;
    try {
        const metadata  = await sock.groupMetadata(grupoId);
        const numeroJid = extrairNumero(jid);

        for (const p of metadata.participants) {
            if (p.admin !== 'admin' && p.admin !== 'superadmin') continue;

            if (p.id === jid) return true;

            const pLid = p.lid
                ? (typeof p.lid === 'string' ? p.lid : p.lid?.toString?.() ?? '')
                : '';
            if (pLid && pLid === jid) return true;

            const numeroPart  = extrairNumero(p.id);
            const numeroPhone = p.phoneNumber ? extrairNumero(p.phoneNumber) : null;

            if (numeroPart === numeroJid)                return true;
            if (numeroPhone && numeroPhone === numeroJid) return true;
        }

        return false;
    } catch {
        return false;
    }
}

// ============================================
// 🎯 HANDLER PRINCIPAL — exportado para messageHandler
// ============================================
export async function handleNotCommand(sock, message) {
    try {
        const grupoId = message.key?.remoteJid;
        if (!grupoId?.endsWith('@g.us')) return false;

        const content = (
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text || ''
        ).trim().toLowerCase();

        if (content !== '#not') return false;

        // ─────────────────────────────────────────────────────────
        // 👮 VERIFICA SE QUEM ENVIOU É ADMIN
        // ─────────────────────────────────────────────────────────
        const adminRaw = message.key?.participant
                      ?? message.key?.participantAlt
                      ?? message.participant
                      ?? null;

        const adminJidResolvido = await obterJidReal(sock, adminRaw, grupoId);

        if (!adminJidResolvido) {
            console.log(`⚠️ [#not] Não foi possível resolver JID do admin: ${adminRaw}`);
            return true;
        }

        const ehAdmin     = await isAdmin(sock, adminJidResolvido, grupoId);
        const adminNumero = extrairNumero(adminJidResolvido);
        const adminJid    = adminJidResolvido.includes('@s.whatsapp.net')
            ? adminJidResolvido
            : `${adminNumero}@s.whatsapp.net`;

        if (!ehAdmin) {
            console.log(`⛔ [#not] +${adminNumero} não é admin. Ignorando.`);
            await enviarMensagem(sock, adminJid, ERRO_NAO_E_ADMIN);
            return true;
        }

        // ─────────────────────────────────────────────────────────
        // 📩 VERIFICA SE É UMA RESPOSTA (contextInfo)
        // ─────────────────────────────────────────────────────────
        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const quotedMsg   = contextInfo?.quotedMessage ?? null;
        const quotedKey   = contextInfo?.stanzaId      ?? null;

        if (!quotedMsg || !quotedKey) {
            console.log(`⚠️ [#not] Admin +${adminNumero} usou #not sem responder nenhuma mensagem.`);
            await enviarMensagem(sock, adminJid, ERRO_NAO_E_RESPOSTA);
            return true;
        }

        // ─────────────────────────────────────────────────────────
        // 👤 RESOLVE O AUTOR DA MENSAGEM CITADA
        // ─────────────────────────────────────────────────────────
        const infractorRaw          = contextInfo?.participant ?? null;
        const infractorJidResolvido = await obterJidReal(sock, infractorRaw, grupoId);

        if (!infractorJidResolvido) {
            console.log(`⚠️ [#not] Não foi possível resolver o infrator: ${infractorRaw}`);
            await enviarMensagem(sock, adminJid, ERRO_NAO_HA_INFRATOR);
            return true;
        }

        const numeroInfrator     = extrairNumero(infractorJidResolvido);
        const jidPrivadoInfrator = infractorJidResolvido.includes('@s.whatsapp.net')
            ? infractorJidResolvido
            : `${numeroInfrator}@s.whatsapp.net`;

        const tipoConteudo = detectarTipoConteudo(quotedMsg);

        // ─────────────────────────────────────────────────────────
        // 🗑️ 1. APAGA O COMANDO #not DO ADMIN
        // ─────────────────────────────────────────────────────────
        console.log(`🗑️ [#not] Apagando comando #not do admin...`);
        await deletarMensagem(sock, grupoId, message.key.id, adminRaw);

        // ─────────────────────────────────────────────────────────
        // 🗑️ 2. APAGA A MENSAGEM INAPROPRIADA (quote)
        //    usa JID resolvido — não o LID raw
        // ─────────────────────────────────────────────────────────
        console.log(`🗑️ [#not] Apagando mensagem inapropriada...`);
        await new Promise(r => setTimeout(r, 500));
        await deletarMensagem(sock, grupoId, quotedKey, jidPrivadoInfrator);

        // ─────────────────────────────────────────────────────────
        // 📊 REGISTRA INFRAÇÃO E CONTA
        // ─────────────────────────────────────────────────────────
        await registrarInfracao(jidPrivadoInfrator, grupoId, tipoConteudo);
        const totalInfracoes = await contarInfracoes(jidPrivadoInfrator, grupoId);

        console.log(`\n🚨 ══════════ #not EXECUTADO ══════════`);
        console.log(`👮 Admin        : +${adminNumero}`);
        console.log(`👤 Infrator     : +${numeroInfrator}`);
        console.log(`📦 Tipo         : ${tipoConteudo}`);
        console.log(`📊 Infrações    : ${totalInfracoes}`);
        console.log(`🏠 Grupo        : ${grupoId}`);
        console.log(`══════════════════════════════════════\n`);

        // ─────────────────────────────────────────────────────────
        // ⚖️ APLICA PUNIÇÃO
        // ─────────────────────────────────────────────────────────
        if (totalInfracoes === 1) {
            await enviarMensagem(sock, jidPrivadoInfrator, AVISO_INFRATOR_1);
            console.log(`⚠️  [1ª INFRAÇÃO] Aviso → +${numeroInfrator}`);

            await enviarMensagem(sock, adminJid, FEEDBACK_ADMIN_1(numeroInfrator));
            console.log(`👮 [FEEDBACK] → +${adminNumero}`);

        } else if (totalInfracoes >= 2) {
            await enviarMensagem(sock, jidPrivadoInfrator, AVISO_INFRATOR_2);

            try {
                await sock.groupParticipantsUpdate(grupoId, [jidPrivadoInfrator], 'remove');
                console.log(`🚨 [REMOÇÃO] +${numeroInfrator} removido | ${totalInfracoes}ª infração`);

                // ✅ NOVO: Adiciona automaticamente à blacklist após remoção
                const motivoBlacklist = `Removido via #not em ${new Date().toLocaleDateString('pt-BR')} | ${totalInfracoes}ª infração`;
                await addToBlacklist(jidPrivadoInfrator, motivoBlacklist);
                console.log(`🛑 [BLACKLIST] +${numeroInfrator} adicionado à blacklist automaticamente.`);

                // 🗑️ Limpa infrações do banco após remoção
                await query(
                    `DELETE FROM infracoes_mensagens WHERE numero = $1 AND grupo_id = $2`,
                    [jidPrivadoInfrator, grupoId]
                );
                console.log(`🗑️ [DB] Infrações de +${numeroInfrator} deletadas do banco.`);
            } catch (err) {
                console.error(`❌ Erro ao remover +${numeroInfrator}:`, err.message);
            }

            await enviarMensagem(sock, adminJid, FEEDBACK_ADMIN_2(numeroInfrator));
            console.log(`👮 [FEEDBACK] → +${adminNumero}: remoção confirmada`);
        }

        return true;

    } catch (err) {
        console.error('❌ Erro em handleNotCommand:', err.message);
        if (DEBUG_MODE) console.error(err.stack);
        return false;
    }
}