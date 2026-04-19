// redefinirFecharGrupo.js

// Função para deletar mensagem com múltiplas tentativas (baseada no antilink)
const deleteCommandMessage = async (sock, groupId, messageKey) => {
    const delays = [0, 100, 500, 1000, 2000, 5000];
    
    for (let i = 0; i < delays.length; i++) {
        try {
            if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));
            
            const key = {
                remoteJid: messageKey.remoteJid || groupId,
                fromMe: false,
                id: messageKey.id,
                participant: messageKey.participant
            };
            
            await sock.sendMessage(groupId, { delete: key });
            console.log(`✅ Comando deletado (tentativa ${i + 1})`);
            return true;
        } catch (error) {
            console.log(`❌ Tentativa ${i + 1} de deletar comando falhou`);
        }
    }
    return false;
};

export async function handleRevokeLink(sock, msg, chatId) {
    try {
        // Deletar o comando
        await deleteCommandMessage(sock, chatId, msg.key);
        
        const newInviteCode = await sock.groupRevokeInvite(chatId);
        
        await sock.sendMessage(chatId, {
            text: `👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\n✅ *Link do grupo redefinido com sucesso!*`
        }, { quoted: msg });
        
    } catch (error) {
        const errorMsg = error.message.includes('forbidden') || error.message.includes('not admin')
            ? '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\n❌ *Erro de permissão!*\n\nEu preciso ser *administrador* do grupo para redefinir o link.'
            : `👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\n❌ Não foi possível redefinir o link.\n\n*Erro:* ${error.message}`;
        
        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: msg });
    }
}

export async function handleCloseGroup(sock, msg, chatId) {
    try {
        // Deletar o comando
        await deleteCommandMessage(sock, chatId, msg.key);
        
        await sock.groupSettingUpdate(chatId, 'announcement');
        
        await sock.sendMessage(chatId, {
            text: '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\n🔒 *Grupo fechado!*\n\nApenas administradores podem enviar mensagens. Use #a ou #opengp para reabrir.'
        }, { quoted: msg });
        
    } catch (error) {
        const errorMsg = error.message.includes('forbidden') || error.message.includes('not admin')
            ? '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\n❌ Preciso ser administrador para fechar o grupo.'
            : `👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\n❌ Erro ao fechar grupo: ${error.message}`;
        
        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: msg });
    }
}

export async function handleOpenGroup(sock, msg, chatId) {
    try {
        // Deletar o comando
        await deleteCommandMessage(sock, chatId, msg.key);
        
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        
        await sock.sendMessage(chatId, {
            text: '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\n🔓 *Grupo reaberto!*\n\nTodos os membros podem enviar mensagens novamente.'
        }, { quoted: msg });
        
    } catch (error) {
        const errorMsg = error.message.includes('forbidden') || error.message.includes('not admin')
            ? '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\n❌ Preciso ser administrador para abrir o grupo.'
            : `👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\n❌ Erro ao abrir grupo: ${error.message}`;
        
        await sock.sendMessage(chatId, { text: errorMsg }, { quoted: msg });
    }
}

export async function handleGroupCommands(sock, message) {
    try {
        const from = message.key.remoteJid;
        const userId = message.key.participant || message.key.remoteJid;
        
        const content = 
            message.message.conversation ||
            message.message.extendedTextMessage?.text ||
            '';
        
        if (!content) return false;
        
        const command = content.toLowerCase().split(' ')[0];
        
        // ✅ Comandos disponíveis (incluindo atalhos rápidos #f e #a)
        if (!['#rlink', '#closegp', '#opengp', '#f', '#a'].includes(command)) {
            return false; // Deixa passar para outros handlers
        }
        
        // Verificar se é um grupo
        if (!from.endsWith('@g.us')) {
            await sock.sendMessage(from, { 
                text: '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\n❌ Este comando só funciona em grupos!' 
            }, { quoted: message });
            return true;
        }
        
        // Verificar se o usuário é admin
        const isUserAdmin = await checkIfUserIsAdmin(sock, from, userId);
        if (!isUserAdmin) {
            // Deletar o comando mesmo se não for admin
            await deleteCommandMessage(sock, from, message.key);
            
            await sock.sendMessage(from, { 
                text: '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\n❌ Apenas administradores podem usar este comando!' 
            }, { quoted: message });
            return true;
        }
        
        // Verificar se o bot é admin
        const isBotAdmin = await checkIfBotIsAdmin(sock, from);
        if (!isBotAdmin) {
            // Deletar o comando mesmo se o bot não for admin
            await deleteCommandMessage(sock, from, message.key);
            
            await sock.sendMessage(from, { 
                text: '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸\n\n❌ Preciso ser administrador do grupo!' 
            }, { quoted: message });
            return true;
        }
        
        // Executar comando
        switch (command) {
            case '#rlink':
                await handleRevokeLink(sock, message, from);
                break;
            case '#closegp':
            case '#f': // 🚨 Atalho rápido para fechar
                await handleCloseGroup(sock, message, from);
                break;
            case '#opengp':
            case '#a': // ✅ Atalho rápido para abrir
                await handleOpenGroup(sock, message, from);
                break;
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao processar comando de grupo:', error);
        return false;
    }
}

async function checkIfUserIsAdmin(sock, groupId, userId) {
    try {
        const groupMetadata = await sock.groupMetadata(groupId);
        
        const participant = groupMetadata.participants.find(p => {
            const pId = p.id.includes('@') ? p.id : `${p.id}@s.whatsapp.net`;
            const uId = userId.includes('@') ? userId : `${userId}@s.whatsapp.net`;
            return pId === uId || p.id === userId || pId.split('@')[0] === uId.split('@')[0];
        });
        
        if (!participant) return false;
        
        return participant.admin === 'admin' || participant.admin === 'superadmin';
    } catch (error) {
        console.error('❌ Erro ao verificar admin do usuário:', error);
        return false;
    }
}

async function checkIfBotIsAdmin(sock, groupId) {
    try {
        const groupMetadata = await sock.groupMetadata(groupId);
        const botJid = sock.user?.jid || sock.user?.id;
        const botNumber = botJid.split(':')[0].split('@')[0];
        
        const participant = groupMetadata.participants.find(p => {
            const participantNumber = p.id.split(':')[0].split('@')[0];
            return participantNumber === botNumber || 
                   p.id === botJid || 
                   p.id === `${botNumber}@s.whatsapp.net` ||
                   p.id.includes(botNumber);
        });
        
        if (!participant) return true; // Tenta executar mesmo assim
        
        return participant.admin === 'admin' || participant.admin === 'superadmin';
    } catch (error) {
        return true; // Em caso de erro, tenta executar
    }
}