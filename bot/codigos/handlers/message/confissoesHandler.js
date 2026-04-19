// confissoesHandler.js - Usuário manda no privado → bot posta no grupo → deleta a mensagem
import pool from '../../../../db.js';

class ConfissoesHandler {

    constructor() {
        // ⚙️ ID do grupo onde as confissões serão postadas
        this.groupId = '120363419322682521@g.us';

        // 🚫 LISTA DE PALAVRAS BLOQUEADAS
        this.palavrasBloqueadas = [
            'buceta', 'puta', 'putinha', 'porra', 'caralho', 'viado',
            'fake',
            'merda', 'foda', 'foder', 'fodase', 'foda-se', 'cu', 'cuzão',
            'vagabunda', 'vagabundo', 'prostituta', 'piranha', 'safada', 'safado',
            'desgraça', 'desgraçado', 'maldito', 'idiota', 'imbecil', 'otario',
            'otário', 'filhadaputa', 'filho da puta','fdp',
            'arrombado', 'arrombada', 'babaca', 'bosta', 'puta que pariu','cachorra','cachorro',
            'cadela','puta','putinha','puto','putinho'
        ];
    }

    // Inicializa a tabela (execute uma vez)
    async initDatabase() {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS confissoes (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(100) NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Tabela de confissões criada/verificada');
        } catch (error) {
            console.error('❌ Erro ao criar tabela:', error);
        }
    }

    // 🚫 Verifica se a confissão contém palavras bloqueadas
    verificarPalavras(texto) {
        const textoLower = texto.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''); // remove acentos para comparar

        const encontradas = this.palavrasBloqueadas.filter(palavra => {
            const palavraNorm = palavra.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
            return textoLower.includes(palavraNorm);
        });

        return encontradas;
    }

    // Extrai o número caso a pessoa coloque no final da mensagem
    // Aceita formatos: +5521999999999 / 5521999999999
    parsearMensagem(content) {
        const texto = content.replace(/^#confissoes\s*/i, '').trim();

        const linhas = texto.split('\n');
        const ultimaLinha = linhas[linhas.length - 1].trim();

        const matchNumero = ultimaLinha.match(/^\+?(\d{10,15})$/);

        if (matchNumero && linhas.length > 1) {
            const numero = matchNumero[1];
            const confissao = linhas.slice(0, -1).join('\n').trim();
            return { numero, confissao };
        }

        return { numero: null, confissao: texto };
    }

    // Processa mensagens no PRIVADO
    async handlePrivateMessage(sock, message, from, userId, content) {
        try {
            if (!content.toLowerCase().startsWith('#confissoes')) {
                return false;
            }

            const { numero, confissao } = this.parsearMensagem(content);

            if (!confissao) {
                await sock.sendMessage(from, {
                    text: '❌ *Por favor, escreva sua confissão após #confissoes*\n\n' +
                          '*Sem marcar ninguém:*\n' +
                          '#confissoes tenho uma queda por vc 😍\n\n' +
                          '*Marcando alguém (número na última linha):*\n' +
                          '#confissoes tenho uma queda por vc 😍\n' +
                          '+552134987655'
                });
                return true;
            }

            // 🚫 Verifica palavras bloqueadas
            const palavrasEncontradas = this.verificarPalavras(confissao);
            if (palavrasEncontradas.length > 0) {
                await sock.sendMessage(from, {
                    text: `🚫 *Confissão rejeitada!*\n\n` +
                          `Sua confissão contém palavras que não são permitidas no confessionário. 😔\n\n` +
                          `✏️ *Reescreva sua confissão* sem palavrões, ofensas ou palavras inadequadas e tente novamente! 💌`
                });
                console.log(`⛔ Confissão de ${userId} rejeitada por palavras bloqueadas: ${palavrasEncontradas.join(', ')}`);
                return true;
            }

            let textoGrupo;
            let mentionList = [];

            if (numero) {
                const jid = `${numero}@s.whatsapp.net`;
                mentionList = [jid];

                textoGrupo = `🎭 *𝙲𝙾𝙽𝙵𝙸𝚂𝚂Ã𝙾 𝙰𝙽Ô𝙽𝙸𝙼𝙰* 💃💬\n\n` +
                             `${confissao}\n\n` +
                             `📌 *Para:* @${numero}\n\n` +
                             `───𖡜ꦽ̸ོ˚￫───ཹ🛐🕯️🔥`;
            } else {
                textoGrupo = `🎭 *𝙲𝙾𝙽𝙵𝙸𝚂𝚂Ã𝙾 𝙰𝙽Ô𝙽𝙸𝙼𝙰* 💃💬\n\n` +
                             `${confissao}\n\n` +
                             `───𖡜ꦽ̸ོ˚￫───ཹ🛐🕯️🔥`;
            }

            // 1️⃣ Salva no banco (apenas o conteúdo)
            const result = await pool.query(
                'INSERT INTO confissoes (user_id, content) VALUES ($1, $2) RETURNING id',
                [userId, confissao]
            );

            // 2️⃣ Posta no grupo
            await sock.sendMessage(this.groupId, {
                text: textoGrupo,
                mentions: mentionList
            });

            // 2.1️⃣ Remove do banco após confirmação de envio no grupo
            await pool.query('DELETE FROM confissoes WHERE id = $1', [result.rows[0].id]);
            console.log(`🗑️ Confissão removida do banco (id: ${result.rows[0].id})`);

            // 3️⃣ Deleta a mensagem original do privado
            try {
                await sock.sendMessage(from, {
                    delete: message.key
                });
                console.log('✅ Mensagem do privado deletada');
            } catch (err) {
                console.log('⚠️ Não foi possível deletar a mensagem:', err.message);
            }

            // 4️⃣ Confirma para o usuário
            await sock.sendMessage(from, {
                text: numero
                    ? `✅ *Confissão enviada anonimamente para @${numero}!* 💌`
                    : `✅ *Confissão enviada anonimamente!* 💌`
            });

            // 5️⃣ Aviso para deletar a mensagem
            await sock.sendMessage(from, {
                text: `🗑️ *Atenção! Só um recadinho...*\n\n` +
                      `Para garantir seu anonimato *100%*, apague sua mensagem aqui do privado! 🤫🔐\n\n` +
                      `Segure a mensagem → *Apagar* → *Apagar para todos* 👆`
            });

            console.log(`✅ Confissão de ${userId} postada no grupo${numero ? ` (marcando ${numero})` : ''}`);
            return true;

        } catch (error) {
            console.error('❌ Erro ao processar confissão:', error);
            await sock.sendMessage(from, {
                text: '❌ Erro ao enviar sua confissão. Tente novamente!'
            });
            return false;
        }
    }
}

export default new ConfissoesHandler();