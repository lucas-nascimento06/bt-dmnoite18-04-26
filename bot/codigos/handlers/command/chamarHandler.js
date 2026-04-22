// chamarHandler.js
import pool from '../../../../db.js';
import axios from 'axios';
import Jimp from 'jimp';

const query = (text, params) => pool.query(text, params);

const FOTO_SALA_VIP = 'https://i.ibb.co/xtCCppwQ/sala-vip.png';

// ============================================
// 🏷️ RODAPÉ FIXO
// ============================================
const RODAPE = `©𝘋𝘢𝘮𝘢𝘴 𝘥𝘢 𝘕𝘪𝘨𝘩𝘵`;

// ============================================
// 🔧 UTILITÁRIOS
// ============================================

function garantirJidCompleto(jid) {
    if (!jid) return jid;
    if (jid.includes('@s.whatsapp.net')) return jid;
    const digitos = jid.replace(/\D/g, '');
    return `${digitos}@s.whatsapp.net`;
}

// ============================================
// 🖼️ HELPERS DE IMAGEM
// ============================================

async function baixarImagem(url) {
    try {
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(res.data, 'binary');
    } catch (err) {
        console.error('❌ Erro ao baixar imagem:', err.message);
        return null;
    }
}

async function gerarThumbnail(buffer, size = 256) {
    try {
        const image = await Jimp.read(buffer);
        image.scaleToFit(size, size);
        return await image.getBufferAsync(Jimp.MIME_JPEG);
    } catch (err) {
        console.error('⚠️ Erro ao gerar thumbnail:', err.message);
        return null;
    }
}

async function enviarComImagem(sock, grupoId, caption, mentions) {
    const fotoBuffer = await baixarImagem(FOTO_SALA_VIP);

    if (fotoBuffer) {
        const thumb = await gerarThumbnail(fotoBuffer);
        try {
            return await sock.sendMessage(grupoId, {
                image: fotoBuffer,
                caption,
                mentions,
                jpegThumbnail: thumb,
            });
        } catch (e) {
            console.warn('⚠️ Fallback para texto sem imagem:', e.message);
        }
    }

    // Fallback: só texto
    return await sock.sendMessage(grupoId, {
        text: caption,
        mentions,
    });
}

// ============================================
// 🗄️ CRIA TABELAS
// ============================================
export async function criarTabelaConvites() {
    await query(`
        CREATE TABLE IF NOT EXISTS convites_pendentes (
            id             SERIAL PRIMARY KEY,
            convidado      TEXT        NOT NULL,
            remetente      TEXT        NOT NULL,
            nome_remetente TEXT        NOT NULL,
            grupo          TEXT        NOT NULL,
            message_key    TEXT        NOT NULL,
            expires_at     TIMESTAMPTZ NOT NULL,
            criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    console.log('🗄️ Tabela convites_pendentes verificada/criada.');
}

// ============================================
// 🔍 RESOLVE JID VIA METADADOS DO GRUPO
// ============================================
async function resolverJidViaGrupo(sock, jidMencionado, grupoJid) {
    try {
        const meta = await sock.groupMetadata(grupoJid);

        let encontrado = meta.participants.find(p => p.id === jidMencionado);

        if (!encontrado) {
            const digitos = jidMencionado.replace(/\D/g, '');
            encontrado = meta.participants.find(
                p => p.id.replace(/\D/g, '') === digitos
            );
        }

        if (encontrado) {
            const jid = encontrado.id;

            if (jid.includes('@lid')) {
                const phone = encontrado.phoneNumber || encontrado.phone;

                if (phone) {
                    const jidReal = phone.includes('@')
                        ? phone
                        : `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
                    console.log(`🔄 [resolverJid] @lid convertido → ${jidReal}`);
                    return jidReal;
                }

                const jidForcado = garantirJidCompleto(jid);
                console.warn(`⚠️ [resolverJid] @lid sem phoneNumber, forçando: ${jidForcado}`);
                return jidForcado;
            }

            return jid;
        }

        console.warn('⚠️ [chamar] Participante não encontrado nos metadados:', jidMencionado);
        return garantirJidCompleto(jidMencionado);

    } catch (e) {
        console.error('❌ [chamar] Erro ao buscar metadados do grupo:', e.message);
        return garantirJidCompleto(jidMencionado);
    }
}

// ============================================
// 🖼️ DEFINE FOTO DO GRUPO
// ============================================
async function definirFotoGrupo(sock, grupoJid, imageUrl) {
    try {
        const buffer = await baixarImagem(imageUrl);
        if (!buffer) return;
        await sock.updateProfilePicture(grupoJid, buffer);
        console.log(`🖼️ [Foto] Capa do grupo ${grupoJid} atualizada!`);
    } catch (e) {
        console.warn('⚠️ [Foto] Não foi possível definir foto do grupo:', e.message);
    }
}

// ============================================
// 🏗️ CRIA GRUPO VIP E SAI IMEDIATAMENTE
// ============================================
async function criarGrupoVip(sock, aceitante, remetente) {
    try {
        const resultado = await sock.groupCreate('💎 Sala VIP - Privado 🔒', [aceitante, remetente]);
        const salaVipId = resultado.id;
        console.log(`🏗️ [Sala VIP] Grupo criado: ${salaVipId}`);

        await definirFotoGrupo(sock, salaVipId, FOTO_SALA_VIP);

        try {
            await sock.groupUpdateDescription(
                salaVipId,
                `🔒 Sala VIP criada pelo Damas da Night.\n` +
                `⚠️ Não compartilhe este grupo.\n` +
                `🗑️ Quando quiserem encerrar, é só deletar o grupo.`
            );
        } catch (e) {
            console.warn('⚠️ [Sala VIP] Não foi possível definir descrição:', e.message);
        }

        try {
            await sock.sendMessage(salaVipId, {
                text:
                    `🔐 *Bem-vindos à Sala VIP!* 🔒\n\n` +
                    `Aqui é um espaço privado para @${remetente.split('@')[0]} e @${aceitante.split('@')[0]}.\n\n` +
                    `🔥 Aproveitem!\n\n` +
                    `🗑️ Quando quiserem encerrar, é só deletar o grupo.\n\n` +
                    `${RODAPE}`,
                mentions: [aceitante, remetente],
            });
        } catch (e) {
            console.warn('⚠️ [Sala VIP] Erro ao enviar mensagem de boas-vindas:', e.message);
        }

        // Bot sai após 40 segundos
        setTimeout(async () => {
            try {
                await sock.groupLeave(salaVipId);
                console.log(`🚪 [Sala VIP] Bot saiu do grupo ${salaVipId}`);
            } catch (e) {
                console.warn('⚠️ [Sala VIP] Erro ao sair do grupo:', e.message);
            }
        }, 40 * 1000);

        return salaVipId;

    } catch (e) {
        console.error('❌ [Sala VIP] Erro ao criar grupo:', e.message);
        return null;
    }
}

// ============================================
// 📩 HANDLER: #chamar
// ============================================
export async function chamarHandler(sock, message, grupo) {
    await sock.sendMessage(grupo, { delete: message.key });

    const remetenteRaw = message.key.participant;

    if (!remetenteRaw) {
        await sock.sendMessage(grupo, {
            text: `❌ Não foi possível identificar o remetente.\n\n${RODAPE}`,
        });
        return true;
    }

    const nomeRemetente = message.pushName || remetenteRaw.split('@')[0];
    const mencionados   = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mencionados.length === 0) {
        await sock.sendMessage(grupo, {
            text: `⚠️ Marque alguém para convidar! Ex: *#chamar @maria*\n\n${RODAPE}`,
        });
        return true;
    }

    const convidadoRaw = mencionados[0];

    if (convidadoRaw === remetenteRaw) {
        await sock.sendMessage(grupo, {
            text: `❌ Você não pode se convidar!\n\n${RODAPE}`,
        });
        return true;
    }

    const convidado = garantirJidCompleto(await resolverJidViaGrupo(sock, convidadoRaw, grupo));
    const remetente = garantirJidCompleto(await resolverJidViaGrupo(sock, remetenteRaw, grupo));

    console.log(`🔍 [DEBUG] JIDs → convidado: ${convidado} | remetente: ${remetente}`);

    // Remove convite anterior do mesmo convidado (por JID exato ou dígitos)
    const digitosConvidado = convidado.replace(/\D/g, '');
    await query(
        `DELETE FROM convites_pendentes
         WHERE convidado = $1 OR REGEXP_REPLACE(convidado, '[^0-9]', '', 'g') = $2`,
        [convidado, digitosConvidado]
    );

    const botNumero = sock.user.id.split(':')[0];

    const caption =
        `💌 𝗖𝗢𝗡𝗩𝗜𝗧𝗘 𝗣𝗔𝗥𝗔 𝗦𝗔𝗟𝗔 𝗩𝗜𝗣 💌\n\n` +
        `@${convidado.split('@')[0]}, você foi convidado por @${remetente.split('@')[0]} para um bate-papo reservado na 𝐒𝐀𝐋𝐀 𝐕𝐈𝐏.\n\n` +
        `📱 Salve o número do bot *${botNumero}* no seu celular ou WhatsApp e digite *#aceitar* ou *#recusar*.\n\n` +
        `${RODAPE}`;

    const msgGrupo = await enviarComImagem(sock, grupo, caption, [convidado, remetente]);

    await query(
        `INSERT INTO convites_pendentes (convidado, remetente, nome_remetente, grupo, message_key, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '5 minutes')`,
        [convidado, remetente, nomeRemetente, grupo, JSON.stringify({ ...msgGrupo.key, remoteJid: grupo })]
    );

    console.log(`💌 [#chamar] ${nomeRemetente} → ${convidado.split('@')[0]}`);

    // Timer de expiração do convite (5 min)
    setTimeout(async () => {
        try {
            const check = await query(
                `SELECT message_key FROM convites_pendentes
                 WHERE convidado = $1 OR REGEXP_REPLACE(convidado, '[^0-9]', '', 'g') = $2`,
                [convidado, digitosConvidado]
            );

            if (check.rowCount === 0) return; // já foi aceito ou recusado

            const key = JSON.parse(check.rows[0].message_key);

            await sock.sendMessage(grupo, {
                text: `⌛ @${convidado.split('@')[0]}, seu convite de @${remetente.split('@')[0]} *expirou*. ❌\n\n${RODAPE}`,
                mentions: [convidado, remetente],
                edit: key.id,
            });

            setTimeout(async () => {
                await query(
                    `DELETE FROM convites_pendentes
                     WHERE convidado = $1 OR REGEXP_REPLACE(convidado, '[^0-9]', '', 'g') = $2`,
                    [convidado, digitosConvidado]
                );
            }, 5000);

        } catch (e) {
            console.error('❌ Erro ao expirar convite:', e.message);
        }
    }, 5 * 60 * 1000);

    return true;
}

// ============================================
// ✅ HANDLER: #aceitar
// ============================================
export async function aceitarHandler(sock, message, grupo) {
    await sock.sendMessage(grupo, { delete: message.key });

    const aceitanteRaw = message.key.participant;

    if (!aceitanteRaw) {
        await sock.sendMessage(grupo, {
            text: `❌ Não foi possível identificar quem está aceitando.\n\n${RODAPE}`,
        });
        return true;
    }

    const aceitante = garantirJidCompleto(await resolverJidViaGrupo(sock, aceitanteRaw, grupo));

    console.log(`🔍 [DEBUG] aceitante → ${aceitante}`);

    // Busca por JID exato OU por dígitos (evita divergência de sufixo)
    const digitos = aceitante.replace(/\D/g, '');
    const res = await query(
        `SELECT * FROM convites_pendentes
         WHERE (convidado = $1 OR REGEXP_REPLACE(convidado, '[^0-9]', '', 'g') = $2)
           AND expires_at > NOW()`,
        [aceitante, digitos]
    );

    if (res.rowCount === 0) {
        await sock.sendMessage(grupo, {
            text: `❌ @${aceitante.split('@')[0]}, você não tem convite pendente ou ele expirou.\n\n${RODAPE}`,
            mentions: [aceitante],
        });
        return true;
    }

    const convite      = res.rows[0];
    const remetenteJid = garantirJidCompleto(convite.remetente);
    const convidadoJid = convite.convidado; // JID original salvo no banco

    // Remove convite do banco pelo JID original salvo
    await query(`DELETE FROM convites_pendentes WHERE convidado = $1`, [convidadoJid]);
    console.log(`🗑️ [#aceitar] Convite removido do banco: ${convidadoJid}`);

    const salaVipId = await criarGrupoVip(sock, aceitante, remetenteJid);

    if (!salaVipId) {
        await sock.sendMessage(grupo, {
            text: `❌ Não foi possível criar a Sala VIP. Tente novamente em instantes.\n\n${RODAPE}`,
        });
        return true;
    }

    await sock.sendMessage(grupo, {
        text:
            `✅ @${aceitante.split('@')[0]} aceitou o convite de @${remetenteJid.split('@')[0]}! 🔒\n\n` +
            `💎 A *𝐒𝐀𝐋𝐀 𝐕𝐈𝐏* foi criada. Aproveitem! 🔥\n\n` +
            `${RODAPE}`,
        mentions: [aceitante, remetenteJid],
    });

    console.log(`✅ [#aceitar] Sala criada: ${aceitante.split('@')[0]} + ${remetenteJid.split('@')[0]} | ${salaVipId}`);
    return true;
}

// ============================================
// ❌ HANDLER: #recusar
// ============================================
export async function recusarHandler(sock, message, grupo) {
    await sock.sendMessage(grupo, { delete: message.key });

    const recusanteRaw = message.key.participant;

    if (!recusanteRaw) return true;

    const recusante = garantirJidCompleto(
        await resolverJidViaGrupo(sock, recusanteRaw, grupo)
    );

    console.log(`🔍 [DEBUG] recusante → ${recusante}`);

    // Busca por JID exato OU por dígitos (evita divergência de sufixo)
    const digitos = recusante.replace(/\D/g, '');
    const res = await query(
        `SELECT * FROM convites_pendentes
         WHERE (convidado = $1 OR REGEXP_REPLACE(convidado, '[^0-9]', '', 'g') = $2)
           AND expires_at > NOW()`,
        [recusante, digitos]
    );

    if (res.rowCount === 0) {
        try {
            await sock.sendMessage(recusante, {
                text: `❌ Você não tem nenhum convite pendente ou ele já expirou.\n\n${RODAPE}`,
            });
        } catch (e) {
            console.warn('⚠️ [#recusar] Não foi possível avisar recusante no privado:', e.message);
        }
        return true;
    }

    const convite      = res.rows[0];
    const remetenteJid = garantirJidCompleto(convite.remetente);
    const convidadoJid = convite.convidado; // JID original salvo no banco

    // Remove convite do banco pelo JID original salvo
    await query(`DELETE FROM convites_pendentes WHERE convidado = $1`, [convidadoJid]);
    console.log(`🗑️ [#recusar] Convite removido do banco: ${convidadoJid}`);

    // Notifica o remetente no privado — discreto, sem expor no grupo
    try {
        await sock.sendMessage(remetenteJid, {
            text:
                `💔 Seu convite para @${recusante.split('@')[0]} foi *recusado*.\n\n` +
                `Sem problemas, quem sabe numa próxima! 😊\n\n` +
                `${RODAPE}`,
            mentions: [recusante],
        });
    } catch (e) {
        console.warn('⚠️ [#recusar] Não foi possível notificar remetente no privado:', e.message);
    }

    // Confirma para quem recusou no privado — ninguém no grupo fica sabendo
    try {
        await sock.sendMessage(recusante, {
            text:
                `✅ Convite de @${remetenteJid.split('@')[0]} *recusado* com sucesso.\n\n` +
                `Ninguém no grupo ficou sabendo. 🤫\n\n` +
                `${RODAPE}`,
            mentions: [remetenteJid],
        });
    } catch (e) {
        console.warn('⚠️ [#recusar] Não foi possível confirmar recusa no privado:', e.message);
    }

    console.log(`❌ [#recusar] ${recusante.split('@')[0]} recusou convite de ${remetenteJid.split('@')[0]}`);
    return true;
}

// ============================================
// 📢 HANDLER: #vip (Admin do grupo - Menciona todos)
// ============================================
export async function vipHandler(sock, message, grupo) {
    await sock.sendMessage(grupo, { delete: message.key });

    const remetenteRaw = message.key.participant || message.key.remoteJid;

    let mentions = [];
    let admins   = [];

    try {
        const meta = await sock.groupMetadata(grupo);
        mentions   = meta.participants.map(p => p.id);
        admins     = meta.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => p.id);

        console.log(`👥 [#vip] ${mentions.length} participantes | ${admins.length} admins`);
        console.log(`🔍 [#vip] remetenteRaw: ${remetenteRaw}`);
        console.log(`🔍 [#vip] admins lista: ${admins.join(', ')}`);

    } catch (e) {
        console.error('❌ [#vip] Erro ao buscar participantes:', e.message);
        await sock.sendMessage(grupo, {
            text: `❌ Não foi possível obter os membros do grupo.\n\n${RODAPE}`,
        });
        return true;
    }

    // Compara por dígitos para evitar divergências de sufixo (@lid vs @s.whatsapp.net)
    const digitosRemetente = remetenteRaw.replace(/@.*$/, '').replace(/\D/g, '');
    const isAdmin = admins.some(
        a => a.replace(/@.*$/, '').replace(/\D/g, '') === digitosRemetente
    );

    console.log(`🔍 [#vip] digitosRemetente: ${digitosRemetente} | isAdmin: ${isAdmin}`);

    if (!isAdmin) {
        await sock.sendMessage(grupo, {
            text: `⛔ Apenas administradores podem usar o *#vip*.\n\n${RODAPE}`,
        });
        return true;
    }

    const poster =
        `🚨 *SALA VIP LIBERADA* 🔐\n\n` +
        `💎 Agora temos *SALA VIP* no grupo!\n\n` +
        `🚫 Não chame no PV sem permissão: alguns chamam sem avisar e outros ficam com vergonha no grupo.\n\n` +
        `✨ *Pensando nisso criamos a SALA VIP!* ✨\n\n` +
        `📌 *Como usar:*\n` +
        `👉 A pessoa interessada escreve no grupo: #chamar + nome da pessoa\n` +
        ` ex: #chamar @fulano\n` +
        `👉 A pessoa convidada responde no grupo: #aceitar ou #recusar\n\n` +
        `🎉 O bot cria uma sala privada só para vocês dois\n\n` +
        `⚠️ *Importante:*\n` +
        `📲 Salve o número do bot\n` +
        `👥 Só entram os dois\n` +
        `🤖 O bot não fica na sala\n` +
        `🤫 Recusas são discretas — ninguém no grupo fica sabendo\n\n` +
        `✔️ Mais respeito e menos constrangimento`;

    await sock.sendMessage(grupo, {
        text: poster,
        mentions: mentions,
    });

    console.log(`📢 [#vip] Poster enviado por ${digitosRemetente} com ${mentions.length} menções.`);
    return true;
}

// ============================================
// 🎯 ENTRADA PRINCIPAL
// ============================================
export async function handleChamarCommand(sock, message, content, from) {
    const lower = content.toLowerCase().trim();

    if (lower.startsWith('#chamar')) return await chamarHandler(sock, message, from);
    if (lower === '#aceitar')        return await aceitarHandler(sock, message, from);
    if (lower === '#recusar')        return await recusarHandler(sock, message, from);
    if (lower === '#vip')            return await vipHandler(sock, message, from);

    return false;
}