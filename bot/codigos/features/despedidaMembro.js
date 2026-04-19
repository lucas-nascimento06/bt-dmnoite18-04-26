// despedidaMembro.js -> E chamada no bot.js

import Jimp from 'jimp';
import axios from 'axios';

/**
 * Gera uma thumbnail a partir de uma URL ou buffer.
 * @param {Buffer|string} input - Buffer da imagem ou URL
 * @param {number} size - tamanho da thumbnail (padrão 256)
 * @returns {Promise<Buffer|null>} - Retorna buffer da thumbnail PNG
 */
async function gerarThumbnail(input, size = 256) {
    try {
        let buffer;
        if (typeof input === 'string') {
            const res = await axios.get(input, { responseType: 'arraybuffer' });
            buffer = Buffer.from(res.data, 'binary');
        } else {
            buffer = input;
        }

        const image = await Jimp.read(buffer);
        image.resize(size, size);
        return await image.getBufferAsync(Jimp.MIME_PNG);
    } catch (err) {
        console.error('Erro ao gerar thumbnail:', err);
        return null;
    }
}

/**
 * Envia imagem/GIF com thumbnail
 * @param {object} sock - instância do Baileys
 * @param {string} jid - ID do grupo ou usuário
 * @param {Buffer} buffer - Buffer da imagem/GIF
 * @param {string} caption - legenda da mensagem
 * @param {string[]} mentions - array com IDs de menções
 */
async function sendMediaWithThumbnail(sock, jid, buffer, caption, mentions = []) {
    try {
        const thumb = await gerarThumbnail(buffer);
        await sock.sendMessage(jid, {
            image: buffer,
            caption,
            mentions,
            jpegThumbnail: thumb
        });
    } catch (err) {
        console.error('Erro ao enviar mídia com thumbnail:', err);
        await sock.sendMessage(jid, { text: caption, mentions });
    }
}

/**
 * Função auxiliar para extrair o identificador correto do participant
 * EXATAMENTE IGUAL AO AVISOADM.JS
 */
const getParticipantId = (participantData) => {
    // Se for string (versão antiga), retorna direto
    if (typeof participantData === 'string') {
        return participantData;
    }
    // Se for objeto (versão nova), extrai phoneNumber ou id
    if (typeof participantData === 'object' && participantData !== null) {
        return participantData.phoneNumber || participantData.id;
    }
    return participantData;
};

/**
 * Configura mensagens de despedida para participantes que saem do grupo
 * ESTRUTURA IGUAL AO AVISOADM.JS - Recebe update completo
 * 
 * @param {object} socket - instância do Baileys
 * @param {object} update - Objeto de atualização completo do grupo
 */
export const configurarDespedida = async (socket, update) => {
    try {
        console.log('🔍 DEBUG DESPEDIDA - Início da função');
        console.log('Update recebido:', JSON.stringify(update, null, 2));

        // ✅ VALIDAÇÃO: Verifica se há participantes
        if (!update.participants || update.participants.length === 0) {
            console.log('❌ Nenhum participante para processar');
            return;
        }

        // ✅ EXATAMENTE IGUAL AO AVISOADM: Extrai dados do update
        const participantData = update.participants[0];
        const participant = getParticipantId(participantData);
        
        console.log('📋 participantData:', participantData);
        console.log('📋 participant extraído:', participant);
        
        // Extrai o número para a menção e o nome do participante
        const participantPhoneNumber = participant.split('@')[0];
        const participantName = participantData?.pushname || participantPhoneNumber || "Usuário";
        
        console.log('📱 participantPhoneNumber:', participantPhoneNumber);
        console.log('👤 participantName:', participantName);
        
        // Para comparação de IDs (quando é objeto, usa o .id)
        const participantIdForComparison = typeof participantData === 'object' && participantData !== null 
            ? participantData.id 
            : participant;
        
        const author = update.author;
        const groupId = update.id;

        console.log('🔍 COMPARAÇÃO:');
        console.log('  participantIdForComparison:', participantIdForComparison);
        console.log('  author:', author);

        // ✅ EXATAMENTE IGUAL AO AVISOADM: Verifica se o usuário saiu por conta própria
        const isUserLeftByThemselves = participantIdForComparison === author;

        console.log('  São iguais?', isUserLeftByThemselves);

        // ✅ SÓ ENVIA DESPEDIDA SE O USUÁRIO SAIU POR CONTA PRÓPRIA
        if (!isUserLeftByThemselves) {
            console.log('❌ Usuário foi removido por admin, despedida não será enviada.');
            return;
        }

        console.log('✅ Usuário saiu voluntariamente, enviando despedida...');

        // Lista de URLs de imagens/GIFs de despedida
        const farewellImages = [
            'https://i.ibb.co/bR2SSbXY/Image-fx-1.jpg',
            'https://i.ibb.co/8DgwmP9n/Image-fx-2.jpg',
            'https://i.ibb.co/tMXFRd3Z/Image-fx-3.jpg',
            'https://i.ibb.co/YFPZ9rJg/Image-fx-4.jpg',
            'https://i.ibb.co/3yp47ctx/Image-fx-5.jpg',
            'https://i.ibb.co/hzKRnpm/Image-fx-6.jpg',
            'https://i.ibb.co/39c3sY6D/Image-fx-7.jpg',
            'https://i.ibb.co/hJW3XQYj/Image-fx-8.jpg',
            'https://i.ibb.co/S77tQ6yz/Image-fx-9.jpg',
            'https://i.ibb.co/ZztMmTHF/Image-fx-10.jpg',
            'https://i.ibb.co/9H5ZyKPL/Image-fx-11.jpg',
            'https://i.ibb.co/ZzzQMyB4/Image-fx-12.jpg',
            'https://i.ibb.co/MxBGN8qt/Image-fx-13.jpg',
            'https://i.ibb.co/TMqvqjX7/Image-fx-14.jpg',
            'https://i.ibb.co/JFxMd2z1/Image-fx-15.jpg',
            'https://i.ibb.co/Y4KMSYYZ/Image-fx-16.jpg',
            'https://i.ibb.co/p8LR5wx/Image-fx-17.jpg',
            'https://i.ibb.co/3yGPBnsh/Image-fx-18.jpg',
            'https://i.ibb.co/93VyVFh7/Image-fx-19.jpg',
            'https://i.ibb.co/6jTNzmh/Image-fx-20.jpg',
            'https://i.ibb.co/Qj3Yfmdr/Image-fx-21.jpg',
            'https://i.ibb.co/VYHL0RtS/Image-fx-22.jpg',
            'https://i.ibb.co/Zp10phZs/Image-fx-23.jpg',
            'https://i.ibb.co/LdQHVHkm/Image-fx-24.jpg',
            'https://i.ibb.co/3Y5yyr3w/Image-fx-25.jpg',
            'https://i.ibb.co/5WQDwkK2/Image-fx-26.jpg',
            'https://i.ibb.co/Cs2SvWmp/Image-fx-27.jpg',
            'https://i.ibb.co/N69HzHtD/Image-fx-28.jpg',
            'https://i.ibb.co/DPBcV89j/Image-fx-29.jpg',
            'https://i.ibb.co/xKHRbFcj/Image-fx-30.jpg',
            'https://i.ibb.co/5gTZd7Z4/Image-fx-31.jpg',
            'https://i.ibb.co/Vh4mhCJ/Image-fx.jpg'
        ];

        // Lista de mensagens de despedida
        const farewellMessages = [
        `💔 *Pior que "quem é você?"* @${participantName}\nO grupo vai ficar mais leve agora, e talvez até com mais inteligência.😏😹\nBoa sorte no mundo real! 😹`,
        `🙋‍♀️💔 *Tchau, tá complicado te encontrar aqui!* @${participantName}\nSuas mensagens eram como Wi-Fi sem sinal...\nSempre ausentes quando mais precisamos. 🛑📶`,
        `😭 Adeus, expert em "não vi a mensagem" @${participantName}\nVocê é tipo aquele amigo que vai embora antes de todo mundo e ainda deixa a casa bagunçada! 😂🏃‍♂️`,
        `💔 *Adeus, fantasma do WhatsApp!* @${participantName}\nAgora que você foi 🥳🚀\nVamos poder conversar sem a sensação de estar sendo ignorado. 🤣✌️`,
        `😭👋 *Tchau, você estava aqui?* @${participantName}\nFicou mais tempo offline do que em qualquer conversa.😎\nQue sua conexão melhore agora que você foi! 😎😹`,
        `😭💔👋 *Que isso, você desapareceu de novo!?* @${participantName}\nNem nos avisa quando vai embora❓ 🤯\nSó sumiu como um story apagado... ⚰️`,
        `💔 Adeus, a "mistério do WhatsApp"! @${participantName}\nVocê já foi mais enigmático(a) que minha última pesquisa no Google! 😹💻🔍`,
        `😎✌️ Tchau, expert em "vou sair logo depois"! @${participantName}\nJá vai tarde, só não vai nos deixar com aquele "depois eu volto", porque... \n sabemos que não volta! 👋⏳`,
        `😭 *Tchau, mestre das desculpas!* @${participantName}\nMais uma desculpa sua foi pro espaço. \n Deixa a gente aqui, tentando entender como alguém sumiu tão rápido! 🤷‍♂️🚀😹`,
        `💔 Vai nessa, mito do "nem sei quem é você"! @${participantName}\nVocê fez tão pouco por aqui que eu até esqueci seu nome... 🤣\nSó que não! 🤭`,
        `😭👋 *Adeus, especialista em "oi" e "tchau"* @${participantName}\nSeus "oi" eram mais esperados que o Wi-Fi em casa.😜\nAgora é só o "tchau" mesmo! 👋😹`,
        `😭 *Te vejo por aí, criador(a) de drama!* @${participantName}\nVocê saiu sem nem avisar se ia voltar. 🚶‍♂️😂\nAgora vai deixar a gente de ressaca emocional. 🍻😭`,
        `💔 *Tchau, o ser humano mais rápido de sair!* @${participantName}\nVocê entrou, causou e saiu antes que alguém dissesse "mas o quê❓" Adeus, ninja do WhatsApp! 🤣`,
        `🙋‍♀️💔 *Adeus, guru da ausência!* @${participantName}\nVocê sumiu mais que meu carregador, e ainda vai deixar saudade... ou não! 😜🔌`,
        `😭💔👋 *Ah, e você ainda vai sair?* @${participantName}\nDa última vez que alguém saiu desse jeito, foi porque o Wi-Fi parou de funcionar.😂\nVai ver que o seu também parou, né❓ 😅`,
        `😭💔👋 *Tchau, que você não volte!* @${participantName}\nMais rápido que você, só quem consegue desaparecer depois do "oi"! Se cuida, ou não. 🏃‍♀️💨`,
        `😭👋 *Adeus, lenda do "minha bateria acabou"* @${participantName}\nVocê tem mais desculpas que o WhatsApp tem atualizações...\nE isso é muito, viu❓ 📱🔋`,
        `😭 *Tchau, mestre da fuga!* @${participantName}\nVocê veio, botou uma piada sem graça, e desapareceu. \n Se precisar de uma dica de "desaparecer sem deixar rastro", chama a gente! 😂`,
        `👋 *Tchau, você deu o ar da graça e agora sumiu* @${participantName}\nQue lenda do "entrei só pra ver como estava"!\nNinguém entendeu nada, mas valeu mesmo assim! 😎`,
        `💔 *Saindo como quem não quer nada* @${participantName}\nAinda ficou a dúvida: você entrou por acidente❓ Porque sumiu rapidinho! 🏃‍♂️💨`,
        `😭 *Deu tchau com a mesma velocidade com que chegou* @${participantName}\nJá vai❓ Só não vale a pena sair agora, estamos todos aqui, ainda tentando te entender! 🤷‍♂️`,
        `🙋‍♀️💔 *Eu não vou mentir, você vai fazer falta!* @${participantName}\nMas só no sentido de que o grupo vai sentir sua "energia ausente".\nBoa sorte! 😜`,
        `💔 *Sabe aquele amigo que entra só pra falar "oi" e "tchau"?* @${participantName}\nEsse é você, né❓ 😂 Espero que o "tchau" tenha sido mais sincero! 👋`,
        `😭 *Agora sim, o grupo vai respirar* @${participantName}\nSua energia sempre foi... digamos, um pouco forte demais para o nosso equilíbrio! 🤪`,
        `😭👋 *Adeus, a falta de vergonha em pessoa* @${participantName}\nSua falta de presença no grupo sempre foi de um nível elevado, eu te admiro! 😹👏`,
        `💔 *Tchau, espírito livre!* @${participantName}\nVocê apareceu, mas parece que se perdeu logo depois.\nVai ser engraçado, porque provavelmente nem viu esse recado! 😜`,
        `😭 *Volta logo, ou não* @${participantName}\nTe mandaram embora ou você se mandou sozinho(a)❓\nFica a dúvida! 😂`,
        `😭👋 *Adeus, você foi uma memória passageira* @${participantName}\nMal entrou e já foi embora.\nFica a saudade... ou não! 😏😹`,
        `💔 *Tchau, ausente* @${participantName}\nJá fez o "oi", o "tchau" e desapareceu com mais classe do que eu. Respeito! 😹👏`,
        `😭 *O grupo agora vai ficar mais chato* @${participantName}\nNão vai ser o mesmo sem as suas mensagens de "não sei o que fazer aqui" 🤔`,
        `😭👋 *Adeus, o mestre do "nada para fazer aqui"* @${participantName}\nSua mensagem era mais rara do que uma chuva no deserto.\nBoa sorte aí! 🏜️`,
        `💔 *Tchau, mestre das desculpas!* @${participantName} \n Mais uma desculpa sua foi pro espaço.\nDeixa a gente aqui, tentando entender como alguém sumiu tão rápido! 🚀`,
        `😭 *Até mais, especialista em sumir na hora certa!* @${participantName}\nVocê estava mais sumido(a) que aquela pessoa que só aparece no final do rolê. 😅`,
        `🙋‍♀️💔 *Adeus, você é tipo Wi-Fi ruim* @${participantName}\nSempre fora de alcance quando mais precisamos.\nVai com Deus e uma conexão melhor! 😹`,
        `💔 *Tchau, estrela cadente* @${participantName}\nApareceu por um segundo e já foi embora.\nO show estava bom, pena que não durou. ✨`,
        `😭 *Tchau, deus da fuga* @${participantName}\nVocê entrou, causou e já saiu, deixando todos em dúvida.\nVai ser difícil esquecer esse show de saída!`,
        `😭👋 *Te vejo por aí... ou não* @${participantName}\nVocê foi uma lenda! Se algum dia aparecer de novo, a gente vai lembrar que te viu! 🤡👋`,
        `💔 *Bye bye, adeus, partiu embora!* @${participantName}\nVai ser difícil a vida continuar sem aquele "oi" só pra sumir depois.🤡😂`,
        `😭 *Te vejo no próximo "adeus"* @${participantName}\nMais uma saída épica no grupo! Vai ser difícil te substituir.\nNinguém mais vai sumir com estilo! 🙃`,
        `😭👋 *Tchau, lenda do "não sei como vim parar aqui"* @${participantName}\n Realmente, não sei como você entrou, mas também não sei como saiu.\nSe cuida! 👋`,
        `💔 *Tchau, sumido(a) do rolê* @${participantName}\nVai deixar saudades.🤪\n Não sei se boas ou ruins, mas pelo menos vai deixar algum tipo de emoção! 😆`,
        `😭 *Saiu como quem não quer nada* @${participantName}\nVocê não deu tchau, não explicou nada, só foi embora e deixou todo mundo em choque.🙄😹\nO drama nunca acaba. 🎭`,
        `🙋‍♀️💔 *Agora o grupo tem mais espaço* @${participantName}\nSem você por aqui, já posso respirar de novo! 😜 Se cuida aí, com a sua vida e energia sempre em modo off. 💨`,
        `👋💀 Alguém acaba de abandonar o barco! @${participantName}\nVai ser difícil viver sem sua energia, mas prometo que vou tentar.\n😂 Se joga por aí, na paz do universo! 🌌`,
        `🌪️💔 *O furacão se foi!* @${participantName}\nAgora o clima vai ser bem mais tranquilo por aqui, sem a sua bagunça. 😆 Vai com tudo aí, até logo! 🌟`,
        `🎤🎶 *Saindo do palco!* @${participantName}\nA plateia vai sentir sua falta, mas nada como uma pausa para repor as energias.\n😜 Aproveita o descanso, mas não demore! 😜`,
        `💀 *A missão foi cumprida!* @${participantName}\nJá pode deixar o grupo, mas não sai sem deixar sua marca... foi épico!\n⚡ Cuide de si e das suas aventuras fora daqui! 😎`,
        `🚶‍♀️💨 *Fugiu da encrenca!* @${participantName}\nOlha, você foi embora, mas a vibe não vai ser mais a mesma sem sua energia.\n😝 Se joga aí e não deixa de nos visitar! 😉`,
        `🚪🔒 *Porta fechada!* @${participantName}\nAgora o grupo vai ser mais calmo... só não sei se vai ser mais interessante!\n😂 Entra em modo zen, e nos avise quando voltar! ✌️`,
        `💔🤔 *Alguém sumiu!* @${participantName}\nOlha, a vibe ficou mais leve, mas falta aquele toque especial de loucura que só você sabia trazer!\n😆 Fica bem aí e não suma por muito tempo! ✌️`,
        `🎬🍿 *Fim de temporada!* @${participantName}\nJá pode voltar pro seu roteiro solo, a novela por aqui vai continuar sem você... mas vamos tentar!\n😜 Nos avise quando voltar a gravar! 🎥`,
        `🐾🦶 *Saiu da zona de conforto!* @${participantName}\nAgora só vai sobrar sossego por aqui. 😝 Mas não faz muita falta, né?\n😂 Vai ser feliz e cuida da sua paz!`,
        `🎉🚶‍♂️ *O show acabou!* @${participantName}\nAgora que o 'mestre da bagunça' foi embora, a paz vai reinar.\nSó não vale sumir pra sempre! 😂 Até a próxima bagunça! 💥`,
        `👋🚀 *Partiu missão fora do grupo!* @${participantName}\nAgora o clima vai ser de paz... mas com uma pitada de saudade!\n😝 Vai curtir a vibe fora, mas promete que vai dar notícias! ✌️`,
        `🔥💨 *Explosão de energia desligada!* @${participantName}\nO grupo vai até respirar melhor sem o seu toque de caos!\n😂 Vai com tudo, mas não demore, sentimos sua falta (um pouquinho)! 😜`,
        `⚡🌪️ *Vibração positiva em modo off!* @${participantName}\nA energia aqui vai diminuir um pouco sem você, mas a gente sobrevive, né?\n😆 Vai com calma e nos avisa quando voltar pro agito! 🚀`,
        `👻🕵️‍♂️ Desapareceu na neblina! @${participantName}\nFiquei sem entender muito bem, mas boa sorte no mundo fora daqui!\n😜 Nos avise quando voltar a fazer bagunça por aqui! 😂`,
        `🎮❌ *Saindo da partida!* @${participantName}\nAgora o time vai sentir a falta do seu game, mas bora jogar no modo solo por um tempo.\n😆 Vai com tudo e volta quando tiver saudade! 💥`,
        `🤡👋 *Olha quem resolveu vazar!* @${participantName}\nVocê entrou, não falou nada, e agora tá saindo igual ladrão de galinha! 🐔😂\nAté mais, invisível! 👻`,
        `😂🎪 *Lá vai o palhaço!* @${participantName}\nO circo ficou mais vazio, mas pelo menos agora sobra pipoca pra gente! 🍿\nVai com Deus e com suas piadas ruins! 🤣`,
        `🏃‍♂️💨 *Correee que o Sonic tá perdendo!* @${participantName}\nVocê saiu mais rápido que criança quando a mãe chama pra lavar louça! 😹\nFlw, Flash! ⚡`,
        `🦗🔇 *Silêncio no estúdio!* @${participantName}\nEspera... você falou alguma coisa antes de sair? Porque ninguém percebeu! 😂\nAté nunca, mudo(a)! 🤐`,
        `🎭😭 *Que drama, hein!* @${participantName}\nSaiu igual ator de novela mexicana... cheio de efeitos especiais mas ninguém entendeu nada! 📺😂\nAté logo, protagonista! 🌟`,
        `🧟‍♂️💀 *O zumbi acordou e resolveu sair!* @${participantName}\nVocê dava menos sinal de vida que múmia no museu! 🏛️\nBoa sorte no além, criatura! 😹`,
        `🦖🦕 *Era dos dinossauros!* @${participantName}\nSuas mensagens eram tão raras que achei que você tinha entrado em extinção! 🌋\nAdeus, fóssil! 💀😂`,
        `🎯❌ *Errou o alvo!* @${participantName}\nVocê entrou no grupo errado, ficou perdido(a), e agora tá saindo mais perdido(a) ainda! 🗺️😂\nGPS tá precisando de atualização, hein! 📱`,
        `🍕🚪 *Saiu antes da pizza chegar!* @${participantName}\nSempre sai na hora boa, né? Genial! 🤦‍♂️\nMais sorte da próxima vez! 😂🍕`,
        `🎬🎞️ *Cortaaaa!* @${participantName}\nSua participação nesse filme foi tão curta que nem apareceu nos créditos! 🎥\nNem o elenco de apoio te reconhece! 😹`,
        `🐌🏃‍♀️ *Passou um caracol e você ainda perdeu!* @${participantName}\nSua lentidão em responder era lendária! 🏆\nAgora até a lesma tá rindo de você! 🐌😂`,
        `🎪🤹 *O malabarista caiu!* @${participantName}\nTentou fazer várias coisas ao mesmo tempo, não fez nada, e agora tá indo embora! 😂\nAplausos pra essa performance! 👏😹`,
        `☕🥱 *Mais devagar que internet da vovó!* @${participantName}\nVocê demorava tanto pra responder que a mensagem chegava por telegrama! 📠\nBye bye, Jurassic Park! 🦕`,
        `🎲🎰 *Jogou, perdeu e vazou!* @${participantName}\nSua sorte no grupo foi tipo bilhete de rifa... nunca ganha nada! 🎟️😂\nTenta de novo em 2050! 🚀`,
        `🌵🏜️ *Olha o deserto ambulante!* @${participantName}\nSuas mensagens eram mais secas que o Saara! ☀️\nPelo menos agora a gente economiza água! 💧😹`,
        `🎸🔇 *A banda desafinou!* @${participantName}\nVocê era tipo aquele instrumento que ninguém sabe tocar... e nem queria aprender! 🎺\nTchau, triângulo do grupo! 😂`,
        `🦸‍♂️🦸‍♀️ *Anti-herói saiu de cena!* @${participantName}\nSeu super poder era sumir sem explicação! 💨\nMarvel tá querendo te contratar! 🎬😹`,
        `🌪️🍃 *Passou tipo vento!* @${participantName}\nFez menos barulho que pum de formiga! 🐜\nNem sentimos sua presença! 😂👋`,
        `🎮👾 *Game Over!* @${participantName}\nSuas lives foram tão curtas que nem chegou na fase 2! 🕹️\nTenta o modo fácil da próxima vez! 😹`,
        `🍔🍟 *Saiu antes do lanche!* @${participantName}\nQuem sai no meio da farra não come da farofa! 🎉\nFica aí com fome mesmo! 😂🍴`,
        `🚁🪂 *Helicóptero Apache!* @${participantName}\nVocê helicóptero apache que só passa voando e não pousa nunca! 🚁\nAté a próxima sobrevoada! 😂✈️`,
        `🎪🤡 *Esqueceu a peruca!* @${participantName}\nO palhaço saiu mas a piada ficou... você! 😂🔴\nVolta pra pegar seu nariz vermelho! 👃`,
        `📱🔋 *Bateria: 0%* @${participantName}\nSua energia no grupo sempre foi baixa mesmo! ⚡\nVai carregar aí e não volta! 🔌😹`,
        `🎯🙈 *Nem acertou, nem errou... nem apareceu!* @${participantName}\nVocê foi tipo aquele amigo imaginário... só que sem a parte imaginária! 👻\nAdeus, John Cena do WhatsApp! 😂`,
        `🍿🎬 *Saiu no trailer!* @${participantName}\nNem chegou no filme completo e já desistiu! 🎥\nSpoiler: ninguém sentiu sua falta! 😹🍿`,
        `🦄🌈 *Mais raro que unicórnio!* @${participantName}\nSuas aparições eram lendárias... literalmente nunca existiram! 🐴\nVai pastar em outro grupo! 😂`,
        `🎲🃏 *Curinga fora do baralho!* @${participantName}\nVocê era a carta que ninguém queria jogar! ♠️♥️\nBoa sorte no próximo jogo de truco! 🎴😹`,
        `🌙⭐ *Estrela cadente versão turtle!* @${participantName}\nCaiu devagar, não brilhou nada, e ninguém fez pedido! 💫\nTchau, meteorito meia-boca! 🪨😂`,
        `🎺📯 *A fanfarra desistiu!* @${participantName}\nAté a banda parou de tocar quando você saiu... de alívio! 🎵\nMenos um pra desafinar! 😹🎶`,
        `🦖💤 *Dormiu na era do gelo!* @${participantName}\nVocê hibernou tanto que perdeu todas as estações! ❄️🌸☀️🍂\nAcorda em 2077! 🤖😂`
        ];

        // Seleciona imagem e mensagem aleatórias
        const randomImage = farewellImages[Math.floor(Math.random() * farewellImages.length)];
        const randomMessage = farewellMessages[Math.floor(Math.random() * farewellMessages.length)];

        console.log('📤 Enviando despedida...');
        console.log('🖼️ Imagem selecionada:', randomImage);
        console.log('💬 Mensagem:', randomMessage);

        // Baixa e envia a imagem com mensagem
        const res = await axios.get(randomImage, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(res.data, 'binary');

        await sendMediaWithThumbnail(socket, groupId, buffer, randomMessage, [participant]);
        
        console.log('✅ Despedida enviada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao processar despedida:', error.message);
        console.error('Stack:', error.stack);
    }
};
