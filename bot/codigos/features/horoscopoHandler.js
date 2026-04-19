// horoscopoHandler.js
import axios from 'axios';

// Mapa de signos em português para inglês
const signosMap = {
    'aries': 'aries',
    'áries': 'aries',
    'touro': 'taurus',
    'gêmeos': 'gemini',
    'gemeos': 'gemini',
    'cancer': 'cancer',
    'câncer': 'cancer',
    'leão': 'leo',
    'leao': 'leo',
    'virgem': 'virgo',
    'libra': 'libra',
    'escorpião': 'scorpio',
    'escorpiao': 'scorpio',
    'sagitário': 'sagittarius',
    'sagitario': 'sagittarius',
    'capricórnio': 'capricorn',
    'capricornio': 'capricorn',
    'aquário': 'aquarius',
    'aquario': 'aquarius',
    'peixes': 'pisces'
};

// Emojis para cada signo
const signosEmoji = {
    'aries': '♈',
    'taurus': '♉',
    'gemini': '♊',
    'cancer': '♋',
    'leo': '♌',
    'virgo': '♍',
    'libra': '♎',
    'scorpio': '♏',
    'sagittarius': '♐',
    'capricorn': '♑',
    'aquarius': '♒',
    'pisces': '♓'
};

// Traduções manuais dos campos
const traducoes = {
    mood: {
        'Happy': 'Feliz',
        'Sad': 'Triste',
        'Energetic': 'Energético',
        'Calm': 'Calmo',
        'Excited': 'Animado',
        'Relaxed': 'Relaxado',
        'Anxious': 'Ansioso',
        'Peaceful': 'Pacífico',
        'Optimistic': 'Otimista',
        'Thoughtful': 'Pensativo'
    },
    color: {
        'Red': 'Vermelho',
        'Blue': 'Azul',
        'Green': 'Verde',
        'Yellow': 'Amarelo',
        'Orange': 'Laranja',
        'Purple': 'Roxo',
        'Pink': 'Rosa',
        'White': 'Branco',
        'Black': 'Preto',
        'Gold': 'Dourado',
        'Silver': 'Prateado',
        'Brown': 'Marrom'
    }
};

// Função CORRIGIDA para obter data no Brasil com ajuste de período
function getDataBrasil(periodo = 'hoje') {
    const agora = new Date();
    const brasilia = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    
    // Ajusta a data conforme o período solicitado
    if (periodo === 'amanhã' || periodo === 'amanha' || periodo === 'tomorrow') {
        brasilia.setDate(brasilia.getDate() + 1);
    } else if (periodo === 'ontem' || periodo === 'yesterday') {
        brasilia.setDate(brasilia.getDate() - 1);
    }
    
    return brasilia.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
}

// Função para traduzir texto usando API gratuita MyMemory
async function traduzirTexto(texto) {
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=en|pt-br`;
        const response = await axios.get(url, { timeout: 5000 });
        
        if (response.data && response.data.responseData && response.data.responseData.translatedText) {
            return response.data.responseData.translatedText;
        }
        return texto;
    } catch (error) {
        console.log('Erro na tradução:', error.message);
        return texto;
    }
}

// Função melhorada: busca na API em português do Brasil
async function buscarHoroscopoPortugues(signo, periodo) {
    try {
        const signosMapPtBr = {
            'áries': 'aries',
            'aries': 'aries',
            'touro': 'touro',
            'gêmeos': 'gemeos',
            'gemeos': 'gemeos',
            'câncer': 'cancer',
            'cancer': 'cancer',
            'leão': 'leao',
            'leao': 'leao',
            'virgem': 'virgem',
            'libra': 'libra',
            'escorpião': 'escorpiao',
            'escorpiao': 'escorpiao',
            'sagitário': 'sagitario',
            'sagitario': 'sagitario',
            'capricórnio': 'capricornio',
            'capricornio': 'capricornio',
            'aquário': 'aquario',
            'aquario': 'aquario',
            'peixes': 'peixes'
        };

        const signoPtBr = signosMapPtBr[signo.toLowerCase()];
        
        // Tenta API brasileira primeiro
        const url = `https://api.js.langapi.workers.dev/horoscopo/${signoPtBr}`;
        const response = await axios.get(url, { timeout: 8000 });
        
        if (response.data && response.data.previsao) {
            const emoji = signosEmoji[signosMap[signo.toLowerCase()]];
            const dataBrasil = getDataBrasil(periodo);
            
            return {
                sucesso: true,
                mensagem: `${emoji} *HORÓSCOPO - ${signo.toUpperCase()}* ${emoji}\n\n` +
                    `📅 *Data:* ${dataBrasil}\n\n` +
                    `🔮 *Previsão:*\n${response.data.previsao}\n\n` +
                    `_© Damas da Night_`
            };
        }
    } catch (error) {
        console.log('API brasileira falhou:', error.message);
    }
    return null;
}

// Função principal para buscar horóscopo
export async function buscarHoroscopo(signo, periodo = 'today') {
    try {
        const signoNormalizado = signo.toLowerCase().trim();
        const signoIngles = signosMap[signoNormalizado];
        
        if (!signoIngles) {
            return {
                sucesso: false,
                mensagem: '❌ *Signo inválido!*\n\nSignos disponíveis:\n' +
                    '♈ Áries\n♉ Touro\n♊ Gêmeos\n♋ Câncer\n' +
                    '♌ Leão\n♍ Virgem\n♎ Libra\n♏ Escorpião\n' +
                    '♐ Sagitário\n♑ Capricórnio\n♒ Aquário\n♓ Peixes'
            };
        }

        // Tenta buscar em português primeiro
        if (periodo === 'hoje' || periodo === 'today') {
            const resultadoPt = await buscarHoroscopoPortugues(signoNormalizado, periodo);
            if (resultadoPt) return resultadoPt;
        }

        // Se não encontrar, tenta API em inglês (Vercel)
        try {
            const periodoMap = {
                'hoje': 'TODAY',
                'today': 'TODAY',
                'amanha': 'TOMORROW',
                'amanhã': 'TOMORROW',
                'tomorrow': 'TOMORROW',
                'ontem': 'YESTERDAY',
                'yesterday': 'YESTERDAY'
            };

            const day = periodoMap[periodo.toLowerCase()] || 'TODAY';
            const url = `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${signoIngles}&day=${day}`;
            
            const response = await axios.get(url, { timeout: 10000 });
            
            if (response.data && response.data.data) {
                const emoji = signosEmoji[signoIngles];
                const data = response.data.data;
                
                // Traduz a previsão para português
                const previsaoTraduzida = await traduzirTexto(data.horoscope_data);
                const dataBrasil = getDataBrasil(periodo);
                
                return {
                    sucesso: true,
                    mensagem: `${emoji} *HORÓSCOPO - ${signo.toUpperCase()}* ${emoji}\n\n` +
                        `📅 *Data:* ${dataBrasil}\n\n` +
                        `🔮 *Previsão:*\n${previsaoTraduzida}\n\n` +
                        `_© Damas da Night_`
                };
            }
        } catch (erro1) {
            console.log('API Vercel falhou, tentando Aztro...');
        }

        // Tenta API Aztro como última opção
        const response = await axios.post(
            `https://aztro.sameerkumar.website/?sign=${signoIngles}&day=${periodo}`,
            {},
            { timeout: 10000 }
        );
        
        if (response.data) {
            const emoji = signosEmoji[signoIngles];
            const data = response.data;
            
            // Traduz TODOS os textos para português
            const descricaoTraduzida = await traduzirTexto(data.description);
            const compatibilidadeTraduzida = data.compatibility ? await traduzirTexto(data.compatibility) : null;
            const humorTraduzido = data.mood ? (traducoes.mood[data.mood] || await traduzirTexto(data.mood)) : null;
            const corTraduzida = data.color ? (traducoes.color[data.color] || await traduzirTexto(data.color)) : null;
            const dataBrasil = getDataBrasil(periodo);
            
            let mensagem = `${emoji} *HORÓSCOPO - ${signo.toUpperCase()}* ${emoji}\n\n` +
                `📅 *Data:* ${dataBrasil}\n\n` +
                `🔮 *Previsão:*\n${descricaoTraduzida}\n\n`;
            
            if (compatibilidadeTraduzida) {
                mensagem += `💕 *Compatibilidade:* ${compatibilidadeTraduzida}\n`;
            }
            if (humorTraduzido) {
                mensagem += `😊 *Humor:* ${humorTraduzido}\n`;
            }
            if (corTraduzida) {
                mensagem += `🎨 *Cor da sorte:* ${corTraduzida}\n`;
            }
            if (data.lucky_number) {
                mensagem += `🍀 *Número da sorte:* ${data.lucky_number}\n`;
            }
            if (data.lucky_time) {
                mensagem += `⏰ *Horário de sorte:* ${data.lucky_time}\n`;
            }
            
            mensagem += `\n_© Damas da Night_`;
            
            return {
                sucesso: true,
                mensagem: mensagem
            };
        }

    } catch (error) {
        console.error('Erro ao buscar horóscopo:', error.message);
        return {
            sucesso: false,
            mensagem: '❌ *Erro ao buscar horóscopo*\n\nTente novamente em alguns instantes.'
        };
    }
}

// Handler para processar mensagens do WhatsApp
export async function handleHoroscopoCommand(sock, message, args) {
    const chatId = message.key.remoteJid;
    const senderId = message.key.participant || message.key.remoteJid;
    
    // Verifica se o usuário forneceu o signo
    if (args.length === 0) {
        await sock.sendMessage(chatId, {
            text: `@${senderId.split('@')[0]}\n\n` +
                '🔮 *Como usar o comando de horóscopo:*\n\n' +
                '📝 *Formato:* #horoscopo [signo] [período]\n\n' +
                '📌 *Exemplos:*\n' +
                '• #horoscopo leão\n' +
                '• #horoscopo áries hoje\n' +
                '• #horoscopo peixes amanhã\n\n' +
                '♈♉♊♋♌♍♎♏♐♑♒♓',
            mentions: [senderId],
            contextInfo: {
                stanzaId: message.key.id,
                participant: message.key.participant || message.key.remoteJid,
                quotedMessage: message.message
            }
        });
        return;
    }

    // Envia mensagem de carregamento COM REPLY
    await sock.sendMessage(chatId, {
        text: `@${senderId.split('@')[0]}\n\n` +
              '🔮 *Consultando os astros...*\n⏳ Aguarde um momento...',
        mentions: [senderId],
        contextInfo: {
            stanzaId: message.key.id,
            participant: message.key.participant || message.key.remoteJid,
            quotedMessage: message.message
        }
    });

    const signo = args[0];
    const periodo = args[1] || 'hoje';
    
    const resultado = await buscarHoroscopo(signo, periodo);
    
    // Envia o resultado COM REPLY e menção
    await sock.sendMessage(chatId, {
        text: `@${senderId.split('@')[0]}\n\n${resultado.mensagem}`,
        mentions: [senderId],
        contextInfo: {
            stanzaId: message.key.id,
            participant: message.key.participant || message.key.remoteJid,
            quotedMessage: message.message
        }
    });
}

// Função auxiliar para listar todos os signos
export function listarSignos() {
    return '🔮 *SIGNOS DO ZODÍACO* 🔮\n\n' +
        '♈ *Áries* (21/03 - 19/04)\n' +
        '♉ *Touro* (20/04 - 20/05)\n' +
        '♊ *Gêmeos* (21/05 - 20/06)\n' +
        '♋ *Câncer* (21/06 - 22/07)\n' +
        '♌ *Leão* (23/07 - 22/08)\n' +
        '♍ *Virgem* (23/08 - 22/09)\n' +
        '♎ *Libra* (23/09 - 22/10)\n' +
        '♏ *Escorpião* (23/10 - 21/11)\n' +
        '♐ *Sagitário* (22/11 - 21/12)\n' +
        '♑ *Capricórnio* (22/12 - 19/01)\n' +
        '♒ *Aquário* (20/01 - 18/02)\n' +
        '♓ *Peixes* (19/02 - 20/03)\n\n' +
        '💬 *Use:* #horoscopo [signo]';
}

export { signosMap };