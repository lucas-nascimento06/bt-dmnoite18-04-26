// menuOwner.js

const BOT_TITLE = '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ*💃🎶🍾🍸';

/**
 * Extrai apenas os dígitos do número (igual ao blacklistFunctions)
 */
function extractDigits(number) {
    return number.replace(/@.*$/, '').replace(/\D/g, '');
}

/**
 * Menu exclusivo para o dono do bot
 */
export function getOwnerMenu() {
    return `${BOT_TITLE}

━━━━━━━━━━━━━━━━━━━━━━━━━
👑 *MENU DO PROPRIETÁRIO* 👑
━━━━━━━━━━━━━━━━━━━━━━━━━

╔═══════════════════════════
║ 🚫 *BLACKLIST*
╠═══════════════════════════
║ #addlista [número]
║ → Adiciona número à blacklist
║
║ #remlista [número]
║ → Remove número da blacklist
║
║ #verilista [número]
║ → Verifica se número está na blacklist
║
║ #lista
║ → Lista todos os números bloqueados
║
║ #varredura
║ → Varredura manual no grupo
║
║ #infolista
║ → Guia completo da blacklist
║
║ 🔄 Varredura automática ao entrar
╚═══════════════════════════

╔═══════════════════════════
║ ⚠️ *ADVERTÊNCIAS*
╠═══════════════════════════
║ #adv
║ → Advertir usuário (3 = remoção)
║ → Responda a mensagem com #adv
╚═══════════════════════════

╔═══════════════════════════
║ 📢 *ALERTAS E REGRAS*
╠═══════════════════════════
║ #alerta
║ → Sem responder: regras gerais
║ → Respondendo: advertência individual
║
║ #atualizarregras
║ → Limpa cache das regras
║
║ #aviso adm
║ → Envia aviso administrativo
╚═══════════════════════════

╔═══════════════════════════
║ 🏷️ *MARCAR TODOS* (Admins)
╠═══════════════════════════
║ 📝 *#all damas* - TEXTO:
║ → Ex: "Festa 20h #all damas"
║
║ 🖼️ *#all damas* - IMAGEM:
║ → Envie foto com legenda
║
║ 🎥 *#all damas* - VÍDEO:
║ → Envie vídeo com legenda
║
║ 🔄 *#totag* - REPOSTAR:
║ → Modo 1: Envie mensagem com #totag
║ → Modo 2: Responda mensagem com #totag
║ → Reposta marcando todos
╚═══════════════════════════

╔═══════════════════════════
║ 🔨 *BANIMENTO*
╠═══════════════════════════
║ #ban @usuário
║ → Remove usuário do grupo
║
║ *Formas de usar:*
║ • #ban @nome
║ • @nome #ban
║ • Responder mensagem com #ban
║ • Responder imagem com #ban
║
║ *Proteções:*
║ ✅ Não remove admins
║ ✅ Não remove o bot
║ 🗑️ Comando deletado automaticamente
╚═══════════════════════════

╔═══════════════════════════
║ 🔧 *GERENCIAMENTO DE GRUPO*
╠═══════════════════════════
║ 🔒 *FECHAR GRUPO:*
║ → #f (emergência - rápido)
║ → #closegp (comando completo)
║
║ 🔓 *ABRIR GRUPO:*
║ → #a (rápido)
║ → #opengp (comando completo)
║
║ 🔗 *REDEFINIR LINK:*
║ → #rlink
║
║ ⚡ Todos os comandos são deletados
╚═══════════════════════════

╔═══════════════════════════
║ 🎭 *CONFISSÕES ANÔNIMAS*
╠═══════════════════════════
║ *Usuários (Privado):*
║ #confissoes [texto]
║ → Envia confissão anônima
║
║ *Admins (Grupo):*
║ #postarconfissoes
║ → Posta confissões pendentes
║
║ #avisarconfissoes
║ → Avisa sobre a brincadeira
╚═══════════════════════════

╔═══════════════════════════
║ 🔮 *SIGNOS E HORÓSCOPO*
╠═══════════════════════════
║ *Público:*
║ !signo [nome]
║ → Descobre signo pelo nome
║
║ #horoscopo [signo]
║ → Ex: #horoscopo leão
║ → Adicione: hoje, amanhã, ontem
║
║ *Admins:*
║ #damastaro
║ → Gerenciar signos
║
║ #atualizarsignos
║ → Atualizar cache
╚═══════════════════════════

╔═══════════════════════════
║ 🎵 *RECURSOS EXTRAS*
╠═══════════════════════════
║ 🎨 *#stickerdamas*
║ → Criar stickers personalizados
║ → Envie imagem/vídeo com o comando
║
║ 🎶 *Music* - Download de músicas
║ 👁️ *Olhinho* - Detector de vizualização
║ 🧹 *RemoverCaracteres* - Limpa texto
║ 🛡️ *AntiLink* - Proteção automática
║ 👋 *Boas-vindas/Despedida* - Automático
╚═══════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *OBSERVAÇÕES IMPORTANTES*
━━━━━━━━━━━━━━━━━━━━━━━━━

🔐 *Permissões:*
   • Comandos admin: você e bot precisam ser admins
   • Comandos públicos: liberado para todos

🏷️ *Sistema de Marcação:*
   • #all damas - Apenas admins
   • #totag - Reposta com marcação
   • Suporta texto, imagem e vídeo

🚫 *Sistema de Blacklist:*
   • Adicione números com código do país
   • Brasileiros: 55 + DDD + número
   • Estrangeiros: código + número
   • Varredura automática ao entrar

⚠️ *Sistema de Advertências:*
   • 3 advertências = remoção automática
   • Use #adv respondendo mensagem
   • Registro permanente no sistema

🔨 *Sistema de Banimento:*
   • Apenas admins podem usar
   • Admins não podem ser banidos
   • Bot não pode ser banido
   • Comandos apagados automaticamente

🔧 *Gerenciamento de Grupo:*
   • #f / #a - Comandos rápidos
   • #closegp / #opengp - Comandos completos
   • #rlink - Atualiza link do grupo
   • Todos os comandos são deletados

🎭 *Sistema de Confissões:*
   • Usuários enviam no privado do bot
   • Admins postam no grupo
   • 100% anônimo e seguro

🛡️ *Proteções Automáticas:*
   • AntiLink ativo
   • Blacklist com varredura
   • Boas-vindas e despedidas
   • Anti-banimento de admins
   • Detector de vizualização

💡 *Ajuda:*
   • #infolista → Guia da blacklist
   • #avisarconfissoes → Regras de confissões
   • #dmlukownner → Este menu

━━━━━━━━━━━━━━━━━━━━━━━━━
🎭 *DAMAS DA NIGHT* - Bot Premium
━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/**
 * Verifica se o usuário é owner do bot
 * 🔥 USA O MESMO SISTEMA DO BLACKLIST (comparação por dígitos)
 */
function isOwner(userId, ownerNumbers) {
    console.log(`\n🔍 ========= VERIFICAÇÃO DE OWNER =========`);
    console.log(`👤 Verificando userId: ${userId}`);
    console.log(`📋 Lista de owners:`, ownerNumbers);
    
    // Extrai apenas os dígitos do userId (igual ao blacklistFunctions)
    const userDigits = extractDigits(userId);
    console.log(`🔢 Dígitos do usuário: ${userDigits}`);
    
    // Extrai os dígitos de cada owner
    const ownerDigitsList = ownerNumbers.map(owner => {
        const digits = extractDigits(owner);
        console.log(`   📌 Owner ${owner} → dígitos: ${digits}`);
        return digits;
    });
    
    // Verifica se os dígitos do usuário estão na lista de owners
    const isOwnerUser = ownerDigitsList.includes(userDigits);
    
    console.log(`\n🎯 RESULTADO: ${isOwnerUser ? '👑 É OWNER' : '🚫 NÃO É OWNER'}`);
    console.log(`==========================================\n`);
    
    return isOwnerUser;
}

/**
 * Resolve LID para número real usando metadados do grupo
 * 🔥 MESMA LÓGICA DO BLACKLIST scanAndRemoveBlacklisted
 */
async function resolveLidToRealNumber(sock, groupId, userId) {
    try {
        // Se não for LID, retorna o próprio userId
        if (!userId.includes('@lid')) {
            console.log(`   ℹ️ Não é LID, usando userId original: ${userId}`);
            return userId;
        }
        
        console.log(`   🔍 É um LID! Buscando número real nos metadados...`);
        
        // Busca os metadados do grupo
        const groupMetadata = await sock.groupMetadata(groupId);
        
        // Procura o participante com esse LID
        const participant = groupMetadata.participants.find(p => p.id === userId);
        
        if (participant) {
            console.log(`   📊 Participante encontrado:`, JSON.stringify(participant, null, 2));
            
            // Tenta pegar o número real
            if (participant.phoneNumber) {
                const realNumber = participant.phoneNumber;
                console.log(`   ✅ Número real resolvido: ${userId} → ${realNumber}`);
                return realNumber;
            }
        }
        
        console.log(`   ⚠️ Não foi possível resolver LID, usando original: ${userId}`);
        return userId;
        
    } catch (err) {
        console.error(`   ❌ Erro ao resolver LID:`, err.message);
        return userId;
    }
}

/**
 * Handler para o comando do menu do dono
 * 🔥 COM RESOLUÇÃO DE LID PARA NÚMERO REAL
 */
export async function handleOwnerMenu(sock, from, userId, content, ownerNumbers = [], message = null) {
    try {
        const command = content.toLowerCase().trim();
        
        // Comando secreto: #dmlukownner
        if (command !== '#dmlukownner') {
            return false;
        }
        
        console.log(`\n👑 ========= COMANDO OWNER DETECTADO =========`);
        console.log(`👤 Usuário recebido: ${userId}`);
        console.log(`📱 Chat: ${from}`);
        console.log(`📝 Comando: ${command}`);
        
        // 🔥 SE FOR GRUPO E FOR LID, RESOLVE PARA NÚMERO REAL
        let realUserId = userId;
        
        if (from.endsWith('@g.us') && userId.includes('@lid')) {
            console.log(`\n🔄 Resolvendo LID para número real...`);
            realUserId = await resolveLidToRealNumber(sock, from, userId);
            console.log(`✅ Usuário final: ${realUserId}\n`);
        }
        
        // 🔥 VERIFICA SE É OWNER (usando sistema do blacklist)
        if (!isOwner(realUserId, ownerNumbers)) {
            console.log(`🚫 Acesso negado - usuário não é owner`);
            console.log(`=====================================\n`);
            
            // Não envia nada para não revelar que o comando existe
            return true;
        }
        
        console.log(`✅ Acesso permitido - enviando menu...`);
        
        // Envia o menu
        const menu = getOwnerMenu();
        await sock.sendMessage(from, { text: menu });
        
        console.log(`✅ Menu do proprietário enviado com sucesso!`);
        console.log(`=====================================\n`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao processar menu do dono:', error);
        return false;
    }
}

/**
 * Exporta as funções
 */
export default {
    getOwnerMenu,
    handleOwnerMenu,
    isOwner
};