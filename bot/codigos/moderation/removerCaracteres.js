//removerCaracteres.js

// MODERAÇÃO AVANÇADA: Remove mensagens longas e usuários problemáticos
export async function moderacaoAvancada(c, mensagem) {
    const textoMensagem = mensagem.message?.conversation
        || mensagem.message?.imageMessage?.caption
        || mensagem.message?.extendedTextMessage?.text
        || '';

    const LIMITE_CARACTERES = 7000;
    if (!textoMensagem || textoMensagem.length <= LIMITE_CARACTERES) return;

    const grupoId = mensagem.key.remoteJid;
    let usuarioId = mensagem.key.participant || mensagem.key.remoteJid;
    const botId = c.user.id;

    const usuarioIdLimpo = usuarioId.split('@')[0];
    const botIdLimpo = botId.split('@')[0];
    if (usuarioIdLimpo === botIdLimpo) return; // evita remover o próprio bot

    const totalCaracteres = textoMensagem.length;
    const excessoCaracteres = totalCaracteres - LIMITE_CARACTERES;

    try {
        const metadata = await c.groupMetadata(grupoId);
        const admins = metadata.participants
            .filter(p => p.admin)
            .map(a => a.id);

        if (admins.some(adminId => adminId.split('@')[0] === usuarioIdLimpo)) return;

        await c.sendMessage(grupoId, { delete: mensagem.key });
        await c.groupParticipantsUpdate(grupoId, [usuarioId], 'remove');
        await c.groupSettingUpdate(grupoId, 'announcement');

        const adminMentionsText = admins.map(a => `@${a.split('@')[0]}`).join(' ');
        const usuarioIdCompleto = usuarioId.includes('@') ? usuarioId : `${usuarioId}@s.whatsapp.net`;
        const mentions = [...admins.map(a => a.includes('@') ? a : `${a}@s.whatsapp.net`), usuarioIdCompleto];

        // Alerta ao grupo
        const alerta = `
👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸

🚨 *ALERTA DE SEGURANÇA* 🚨
⚠️ O usuário *@${usuarioIdLimpo}* foi *removido* por enviar mensagens suspeitas e extremamente longas.

📊 *Detalhes da mensagem:*
• *Total de caracteres:* ${totalCaracteres.toLocaleString('pt-BR')}
• *Limite permitido:* ${LIMITE_CARACTERES.toLocaleString('pt-BR')}
• *Excesso:* ${excessoCaracteres.toLocaleString('pt-BR')} caracteres

🐌 Mensagens muito longas podem causar *lentidão no WhatsApp*.
🔒 *GRUPO TEMPORARIAMENTE FECHADO*

👨‍💼 *Administradores:* \n ${adminMentionsText} \n
✅ Use *#opengp* para reabrir o grupo.
✅ Use *#status* para verificar se o grupo está aberto ou fechado.

⏰ ${new Date().toLocaleString('pt-BR')}
`;

        await c.sendMessage(grupoId, { text: alerta, mentions });

        // Aviso geral sobre fechamento do grupo
        const avisoGrupo = `
👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸

🔒 *GRUPO TEMPORARIAMENTE FECHADO* 🔒

🚨 Por motivos de *segurança*, o grupo foi fechado temporariamente.
⏳ Pedimos que todos aguardem pacientemente até que um administrador possa reabrir o grupo.

👨‍💼 Apenas *administradores* podem enviar mensagens enquanto o grupo estiver fechado.
⚠️ Evitem enviar mensagens longas (acima de ${LIMITE_CARACTERES.toLocaleString('pt-BR')} caracteres) ou repetitivas para não acionar a moderação automática.

📏 *Dica:* Dividam mensagens muito longas em partes menores.
`;

        await c.sendMessage(grupoId, { text: avisoGrupo });

        console.log(`Usuário ${usuarioIdLimpo} removido do grupo ${grupoId}. Mensagem com ${totalCaracteres} caracteres apagada (excesso: ${excessoCaracteres}).`);
    } catch (error) {
        console.error('Erro na moderação:', error);
        try {
            await c.sendMessage(grupoId, { text: '❌ Erro ao processar mensagem longa. Admins, verifiquem manualmente.' });
        } catch {}
    }
}

// REABRIR GRUPO
export async function reabrirGrupo(c, grupoId, adminId) {
    try {
        const metadata = await c.groupMetadata(grupoId);
        const admins = metadata.participants
            .filter(p => p.admin)
            .map(a => a.id);
        const solicitante = adminId.split('@')[0];

        if (!admins.some(a => a.split('@')[0] === solicitante)) {
            await c.sendMessage(grupoId, { text: '❌ Apenas admins podem reabrir o grupo.', mentions: [adminId] });
            return false;
        }

        await c.groupSettingUpdate(grupoId, 'not_announcement');
        await c.sendMessage(grupoId, { 
            text: `
👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸

✅ *GRUPO REABERTO* 🔓
Reaberto por *@${solicitante}*

📏 *Lembrete:* Limite de *7.000 caracteres* por mensagem
⏰ ${new Date().toLocaleString('pt-BR')}
`,
            mentions: [adminId]
        });

        return true;
    } catch (err) {
        console.error('Erro ao reabrir grupo:', err);
        await c.sendMessage(grupoId, { text: '❌ Erro ao tentar reabrir o grupo.' });
        return false;
    }
}

// STATUS DO GRUPO
export async function statusGrupo(c, grupoId) {
    try {
        const metadata = await c.groupMetadata(grupoId);
        const isFechado = metadata.announce;

        const status = isFechado
            ? `
👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸

🔒 *GRUPO FECHADO* - Apenas admins podem enviar mensagens
📏 *Limite:* 7.000 caracteres por mensagem
`
            : `
👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸

🔓 *GRUPO ABERTO* - Todos podem enviar mensagens
📏 *Limite:* 7.000 caracteres por mensagem
`;

        await c.sendMessage(grupoId, { text: status });
        return !isFechado;
    } catch (err) {
        console.error('Erro ao verificar status:', err);
        return null;
    }
}
