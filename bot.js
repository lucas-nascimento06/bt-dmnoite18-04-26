// bot.js
import 'dotenv/config';
import { connectToWhatsApp } from './bot/bot-connection/whatsappConnection.js';
import { criarTabelaInfracoes } from './bot/codigos/handlers/command/notCommandHandler.js';

console.clear();
console.log("🌙 =======================================");
console.log("🌙    DAMAS DA NIGHT - WhatsApp Bot      ");
console.log("🌙 =======================================\n");

process.on('SIGINT', () => {
    console.log('\n🌙 Bot desconectado');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🌙 Bot finalizado');
    process.exit(0);
});

process.on('unhandledRejection', () => {});

process.on('uncaughtException', (error) => {
    if (error.message.includes('baileys') || error.message.includes('socket')) return;
    console.error('❌ Erro crítico:', error.message);
});

// Inicia tabelas e conexão
await criarTabelaInfracoes();
connectToWhatsApp();