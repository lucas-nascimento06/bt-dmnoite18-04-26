// bot/utils/autoScan.js
import { scanAndRemoveBlacklisted } from '../codigos/moderation/blacklist/blacklistFunctions.js';

export async function autoScanGroups(sock) {
    console.log('🔍 ========= INICIANDO VARREDURA AUTOMÁTICA =========\n');
    
    try {
        // Busca todos os grupos
        const groups = await sock.groupFetchAllParticipating();
        const groupIds = Object.keys(groups);
        
        console.log(`📋 Total de grupos encontrados: ${groupIds.length}\n`);
        
        let totalRemovidos = 0;
        
        // Varre cada grupo
        for (let i = 0; i < groupIds.length; i++) {
            const groupId = groupIds[i];
            const groupName = groups[groupId].subject;
            
            console.log(`[${i + 1}/${groupIds.length}] 🔍 Varrendo: ${groupName}`);
            
            try {
                const resultado = await scanAndRemoveBlacklisted(groupId, sock);
                console.log(`   ${resultado}`);
                
                // Conta quantos foram removidos
                const match = resultado.match(/(\d+) usuário/);
                if (match) {
                    totalRemovidos += parseInt(match[1]);
                }
                
            } catch (err) {
                console.error(`   ❌ Erro ao varrer ${groupName}:`, err.message);
            }
            
            // Delay de 2 segundos entre grupos
            if (i < groupIds.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log('\n✅ ========= VARREDURA COMPLETA =========');
        console.log(`🚨 Total removido: ${totalRemovidos} usuário(s) da blacklist`);
        console.log('==========================================\n');
        
    } catch (err) {
        console.error('❌ Erro na varredura automática:', err);
    }
}