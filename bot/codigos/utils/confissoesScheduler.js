//confissoesScheduler.js

import cron from 'node-cron';
import confissoesHandler from '../handlers/message/confissoesHandler.js';

export function initConfissoesScheduler(sock) {
    // ID do grupo onde as confissões serão postadas
    const GROUP_ID = 'SEU_ID_DO_GRUPO_AQUI@g.us'; // Ex: 120363123456789012@g.us
    
    // ⚠️ MODO TESTE: Descomente a linha abaixo para agendar automaticamente
    // Atual: DESATIVADO - use apenas o comando manual #postarconfissoes
    
    /*
    // Agenda para toda quarta-feira às 12:00 (meio-dia)
    cron.schedule('0 0 12 * * 3', async () => {
        console.log('🕐 Executando Quarta-feira das Confissões...');
        
        try {
            await confissoesHandler.postarConfissoes(sock, GROUP_ID);
            console.log('✅ Confissões postadas com sucesso!');
        } catch (error) {
            console.error('❌ Erro ao postar confissões:', error);
        }
    }, {
        scheduled: true,
        timezone: "America/Fortaleza"
    });
    
    console.log('📅 Scheduler de confissões iniciado! (Quarta-feira às 12:00)');
    */
    
    console.log('📅 Modo TESTE ativado - use #postarconfissoes no grupo para testar');
    console.log(`📍 Grupo configurado: ${GROUP_ID}`);
}

// Outros horários úteis (comentados para referência):
/*
// Todo dia às 09:00
cron.schedule('0 0 9 * * *', ...)

// Toda sexta às 18:00
cron.schedule('0 0 18 * * 5', ...)

// Todo sábado ao meio-dia
cron.schedule('0 0 12 * * 6', ...)
*/