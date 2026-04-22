// ============================================================
//  rainhaHandler.js  →  bot/codigos/handlers/command/
//  Comando: #rainhadamas
// ============================================================

import axios from 'axios';
import Jimp from 'jimp';
import { getRainhaDoDia } from '../../utils/rainhaModel.js';

const NOME_GRUPO = '👏🍻 *DﾑMﾑS* 💃🔥 *Dﾑ* *NIGӇԵ* 💃🎶🍾🍸';
const FOTO_URL   = 'https://i.ibb.co/hRL49PzN/4d2c6f7c-c383-4643-b278-8be8d6be4111-1.png';

// ============================================================
//  Helpers de verificação de admin (baseado em redefinirFecharGrupo.js)
// ============================================================

async function checkIfUserIsAdmin(client, groupId, userId) {
  try {
    const groupMetadata = await client.groupMetadata(groupId);

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

const deleteCommandMessage = async (client, groupId, messageKey) => {
  const delays = [0, 100, 500, 1000, 2000, 5000];

  for (let i = 0; i < delays.length; i++) {
    try {
      if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]));

      const key = {
        remoteJid: messageKey.remoteJid || groupId,
        fromMe: false,
        id: messageKey.id,
        participant: messageKey.participant,
      };

      await client.sendMessage(groupId, { delete: key });
      console.log(`✅ Comando deletado (tentativa ${i + 1})`);
      return true;
    } catch {
      console.log(`❌ Tentativa ${i + 1} de deletar comando falhou`);
    }
  }
  return false;
};

// ============================================================
//  Helpers de imagem
// ============================================================

async function baixarImagem() {
  try {
    const res = await axios.get(FOTO_URL, { responseType: 'arraybuffer' });
    return Buffer.from(res.data, 'binary');
  } catch (err) {
    console.error('❌ Erro ao baixar imagem da rainha:', err.message);
    return null;
  }
}

async function gerarThumbnail(buffer, size = 256) {
  try {
    const image = await Jimp.read(buffer);
    image.scaleToFit(size, size);
    return await image.getBufferAsync(Jimp.MIME_JPEG);
  } catch (err) {
    console.error('Erro ao gerar thumbnail:', err);
    return null;
  }
}

async function enviarComImagem(client, grupoId, buffer, legenda, mencoes) {
  try {
    const thumb = await gerarThumbnail(buffer);
    await client.sendMessage(grupoId, {
      image: buffer,
      caption: legenda,
      mentions: mencoes,
      jpegThumbnail: thumb,
    });
    return true;
  } catch {
    try {
      await client.sendMessage(grupoId, { image: buffer, caption: legenda, mentions: mencoes });
      return true;
    } catch (err2) {
      console.error('❌ Erro no fallback de imagem:', err2.message);
      return false;
    }
  }
}

// ============================================================
//  Frases
// ============================================================

const FRASES_RAINHA = [
  '👑💥 *ATENÇÃO, TROPINHA DO FIM DE TABELA!* 💥👑\n_Hoje não teve competição, teve é H U M I L H A Ç Ã O em HD, 4K, com legenda em braile e narração em coreano! Ela chegou, dominou, dançou no tapete vermelho e ainda deixou migalhas pros outros tentarem juntar com lupa!_ 🧐😂',

  '🤣👑 *SE ISSO AQUI FOSSE REALITY SHOW...* 👑🤣\n_Ela já tava com o prêmio, o carro zero, a casa na praia, o contrato com a Globo e um reality só dela na Netflix! O resto do grupo só participou da chamada do programa, ela protagonizou a novela inteira, o spin-off e o making of!_ 🎬😂',

  '💅🔥 *ELA NÃO CONVERSOU HOJE...* 🔥💅\n_Ela comandou o grupo igual capitã de navio em alto-mar com tubarão ao redor! Enquanto vocês pensavam no que responder, ela já tinha mandado 15 mensagens, corrigido o português de três, mandado áudio de 4 minutos sem respirar e ainda postou figurinha! Pode fechar o chat, amanhã vocês tentam de novo (ou não)._ 😭',

  '👑😂 *O GRUPO TENTOU ACOMPANHAR...* 😂👑\n_…mas faltou fôlego, wi-fi, bateria, sorte e QI! Ela tava em modo "chefão final da última fase", enquanto vocês ainda escolhiam o boneco no tutorial. Ela deu até 5 minutos de vantagem e mesmo assim chegou primeiro com direito a replay da vitória!_ 🎮👾',

  '💥👸🏻 *ELA DIGITAVA E PARECIA EVENTO MUNDIAL!* 👸🏻💥\n_Cada mensagem dela vinha com fogos de artifício, torcida organizada, narrador gritando "GOOOOOL" e ainda uma musiquinha de fundo! Vocês mandaram "kkk" e ela já tava fazendo a volta olímpica!_ 🏆😂',

  '🤣🔥 *HOJE ELA NÃO MANDOU MENSAGEM...* 🔥🤣\n_Ela fez um podcast de 6 horas, com intervalos comerciais, participação especial do Whisper e direito a fã-clube pedindo bis! O teclado dela fumegou de tanto uso, e o WhatsApp pediu desculpas por não conseguir acompanhar o ritmo!_ 🎙️😭',

  '👑💅 *RAINHA QUE É RAINHA NÃO DISPUTA...* 💅👑\n_Ela deixa os outros discutindo o segundo lugar feito cachorro brigando por osso! Enquanto vocês se estranham, ela já tá no camarote vip tomando champagne e rindo da briga lá embaixo!_ 🥂😂',

  '😂👸🏻 *ELA FALOU TANTO QUE O TECLADO PEDIU ARREGO!* 👸🏻😂\n_As letras do celular dela começaram a suar, a tecla do enviar entrou em greve e a bateria pediu transferência! E o grupo? Só assistindo o show igual plateia de programa do SBT!_ 📱💦',

  '🔥👑 *SIMPLESMENTE IMPOSSÍVEL COMPETIR!* 👑🔥\n_O grupo virou plateia oficial hoje, mas plateia daquelas que nem pode gritar porque a atração principal já resolveu tudo sozinha! Vocês tentaram reagir, mas ela respondeu antes de vocês pensarem na resposta._ 🤐😂',

  '🤣💎 *SE MENSAGEM VALESSE DINHEIRO...* 💎🤣\n_Ela já tava milionária, trilionária e comprando a Meta inteira só pra fechar o grupo e comemorar sozinha! Mark Zuckerberg mandou mensagem pedindo pra ela dar um tempo porque os servidores tavam superaquecendo!_ 💰😭',

  '👑😂 *ELA NÃO PARTICIPOU DO GRUPO...* 😂👑\n_ELA CARREGOU NAS COSTAS IGUAL MÃE DE GÊMEOS NO CALOR DE 40 GRAUS SUBINDO LADEIRA! Enquanto vocês mandavam figurinha de "boa noite", ela tava puxando o assunto, respondendo todo mundo, dando risada e ainda arrumando a própria discussão!_ 💪😂',

  '💅🔥 *HOJE FOI ASSIM...* 🔥💅\n_Ela falou, o grupo ouviu, aceitou, concordou, aplaudiu e pediu desculpas por existir! Teve até um momento que alguém tentou contestar, mas o próprio WhatsApp bloqueou a mensagem porque "não tinha nível técnico suficiente"._ 😭👑',

  '👸🏻🤣 *TENTARAM ACOMPANHAR... COITADOS!* 🤣👸🏻\n_Ela já tava 10km na frente, com direito a água no posto, alongamento e selfie na chegada! Vocês ainda estavam amarrar o tênis quando ela já tinha cruzado a linha de chegada, tomado banho e postado stories com a medalha._ 🏃‍♀️🥇😂',

  '👑💥 *ISSO AQUI NÃO FOI ATIVIDADE...* 💥👑\n_FOI MASSACRE DIGITAL, CRIME HEDIONDO CIBERNÉTICO, GENOCÍDIO DE EGO FRÁGIL! O que ela fez com o grupo hoje deveria ser estudado pela ONU como novo método de humilhação em massa!_ ⚖️😂',

  '😂🔥 *O GRUPO TODO DIGITANDO...* 🔥😂\n_E mesmo assim não chegou nem na sombra dela! Vocês no 4G, ela no 8G com antena própria e satélite reserva! Cada mensagem dela era tipo um míssil, as de vocês pareciam bilhetinho de amigo secreto._ 📡😂',

  '👑🤣 *RESUMO DO DIA DE HOJE...* 🤣👑\n_Ela = PROTAGONISTA com letra maiúscula, iluminação própria, trilha sonora original e making of exclusivo. Vocês = figurantes que aparecem borrados no fundo quando ela passa!_ 🎭😂',

  '💅👑 *HOJE ELA FEZ HORA EXTRA DE BRILHAR!* 👑💅\n_O brilho dela tava tão forte que o grupo inteiro precisou usar óculos escuros. Teve até reclamação no condomínio porque o reflexo tava atrapalhando os vizinhos de baixo!_ 😎✨',

  '🔥😂 *ELA DIGITOU TANTO...* 😂🔥\n_Que já pode pedir CLT do grupo com direito a décimo terceiro, férias pagas e vale alimentação! O RH do WhatsApp já abriu processo seletivo só pra contratar o ritmo dela!_ 📝😂',

  '👸🏻💥 *SE TIVESSE REPLAY DO DIA...* 💥👸🏻\n_Era só ela aparecendo com um letreiro gigante escrito "A ESTRELA"! O resto do grupo seria aquele trecho que ninguém assiste porque todo mundo já desligou a TV._ 📺😂',

  '👑🤣 *O GRUPO INTEIRO ONLINE...* 🤣👑\n_18 pessoas conectadas, wi-fi no talo, bateria 100%, e mesmo assim perderam FEIO com direito a vaia e urubu do pix! Ela sozinha com 4G caído deu um baile que vai entrar pra história do WhatsApp!_ 📱😂',

  '😂👑 *ELA CHEGOU QUIETA... MENTIRA!* 👑😂\n_Chegou fazendo barulho igual trio elétrico na véspera do Carnaval! A notificação dela era tão forte que até grupo que ela não participava sentiu o impacto!_ 🔊😂',

  '🔥💅 *RAINHA NÃO ERRA...* 💅🔥\n_No máximo ela exagera no brilho, mas errar? Jamais! Enquanto vocês cometiam "kkk" sem contexto e figurinha repetida, ela mandava a resposta perfeita antes mesmo da pergunta existir._ 👑😂',

  '👑🤣 *HOJE ELA NÃO FOI BEM...* 🤣👑\n_ELA FOI ABSURDA, DESCOMUNAL, ESTRATOSFÉRICA, NIVEL DEUS DO OLIMPO! Se ela fosse nota, quebrava a escala. Se fosse temperatura, derretia o termômetro. Se fosse meme, era o "rato falando" no auge!_ 🔥😂',

  '💥👸🏻 *CADA MENSAGEM DELA ERA...* 👸🏻💥\n_"Toma mais uma, ó: comédia garantida, dilúvio de risada e humilhação grátis pro grupo"! Ela digitava e o chat inteiro virava um "A Fazenda" só com ela na roça!_ 🌾😂',

  '😂🔥 *ELA DIGITAVA...* 🔥😂\n_O grupo pensava em desistir da vida digital, vender o celular, comprar um tijolo e virar eremita! Teve gente que até desinstalou o WhatsApp depois de tanta humilhação virtual!_ 📱❌😂',

  '👑💅 *SIMPLESMENTE SEM CONDIÇÕES DE COMPETIR HOJE!* 💅👑\n_O segundo lugar ficou tão desanimado que pediu pra não divulgar o nome. O terceiro lugar entrou em depressão. E o quarto lugar… nem existia de tão longe que tava!_ 🥇🥲',

  '🤣👸🏻 *ELA FEZ TANTO BARULHO...* 👸🏻🤣\n_Que até quem tava offline sentiu o chão tremer! Teve notificação chegando em telefone desligado, em tablet com defeito, em PC da Xuxa e até no telefone do orelhão da praça!_ 📢😂',

  '🔥👑 *HOJE FOI DOMÍNIO TOTAL...* 👑🔥\n_Pode encerrar o campeonato, devolver os ingressos, apagar o placar e mandar todo mundo pra casa! O troféu já tem dona, a faixa já tá escrita, e o pódio tem espaço só pra ela!_ 🏆😂',

  '😂💥 *ELA TRANSFORNOU O GRUPO NUM SHOW AO VIVO!* 💥😂\n_Com direito a abertura com fanfarra, intervalo pra comercial das Casas Bahia, participação especial do Luciano Huck e fechamento com chuva de papel confete!_ 🎉😂',

  '👑🤣 *HOJE ELA TAVA IMPOSSÍVEL, INACREDITÁVEL...* 🤣👑\n_E INSUPORTAVELMENTE BOA! O nível dela tava tão alto que o próprio grupo pediu pra ela dar um desconto, mas ela respondeu: "Desconto? Só na Black Friday, amores!"_ 🛒😂',

  '💅🔥 *ELA NÃO MANDOU MENSAGEM... ELA DEU AULA!* 🔥💅\n_Aula magna, com mestrado em zoeira, doutorado em humilhação e pós-doc em fazer os outros calarem a boca! Os prints da aula de hoje vão cair no Enem!_ 📚😂',

  '👸🏻😂 *O POVO TENTANDO ACOMPANHAR...* 😂👸🏻\n_E ela já tava em outro planeta, em outra galáxia, em outra dimensão, em outro aplicativo! Ela respondeu no WhatsApp, no Telegram, no Signal e ainda mandou carta pelos Correios antes de vocês terminarem de digitar!_ 🌍😂',

  '👑💥 *RAINHA DO DIA OU DONA DO GRUPO?* 💥👑\n_Difícil decidir porque ela ocupou os dois cargos com tanta maestria que virou sócia majoritária, CEO, presidente do conselho e síndica do condomínio!_ 🏢😂',

  '🤣🔥 *HOJE O CHAT FOI BASICAMENTE...* 🔥🤣\n_Uma live solo dela com 40 minutos de duração, 2 milhões de likes, 500 comentários "EU TE AMO" e nenhuma interação porque ninguém conseguiu acompanhar o ritmo!_ 🎤😂',

  '👑😂 *ELA FALOU TANTO...* 😂👑\n_Que o WhatsApp quase travou, a Meta quase faliu, o servidor quase pegou fogo e o Mark Zuckerberg quase pediu demissão! Um funcionário da empresa disse: "Nunca vimos algo assim"._ 🔥📱',

  '💅👸🏻 *ELEGANTE ATÉ SENDO EXAGERADA!* 👸🏻💅\n_Enquanto vocês digitavam com dois dedos e erravam a palavra "paralelepípedo", ela mandava textão impecável com direito a emojis estrategicamente posicionados e tempo de resposta negativo!_ ✨😂',

  '🔥🤣 *HOJE NÃO TEVE DISPUTA...* 🤣🔥\n_TEVE ATROPELAMENTO EM MASSA, COM TESTEMUNHA, CÂMERAS E LAUDO PERICIAL! O grupo tá tão traumatizado que vai entrar na justiça pedindo danos morais coletivos!_ ⚖️😂',

  '👑💥 *ELA PASSOU POR CIMA DE TODO MUNDO...* 💥👑\n_COM EDUCAÇÃO AINDA! Mandou um "com licença, vou humilhar vocês rapidinho" e ainda perguntou se podia passar o rodo depois! Que elegância na maldade!_ 🧹😂',

  '😂👑 *O RESTO FOI SÓ FIGURANTE PREMIUM!* 👑😂\n_Premium, mas figurante! Pagaram até o pacote VIP pra aparecer borrado no canto da tela enquanto ela fazia a performance principal!_ 🎟️😂',

  '🔥👸🏻 *ELA JOGOU NO MODO HARD...* 👸🏻🔥\n_Enquanto o grupo tava no tutorial aprendendo a pular! Ela já tinha zerado o jogo, platinado, feito 100% dos troféus e desinstalado antes de vocês escolherem o nome do personagem!_ 🎮😂',

  '👑🤣 *SIMPLESMENTE ICÔNICA HOJE!* 🤣👑\n_ICÔNICA, LENDÁRIA, MITOLÓGICA, HISTÓRICA, QUASE PATRIMÔNIO DA HUMANIDADE! A UNESCO já entrou em contato pra registrar a performance de hoje!_ 🏛️😂',

  '💥💅 *HOJE FOI SÓ ELA... E MAIS NINGUÉM!* 💅💥\n_O grupo todo combinado não fez 10% do barulho que ela fez sozinha! Vocês no 0,1% da bateria e ela com 5000% de energia nuclear!_ ⚡😂',

  '😂🔥 *ELA DIGITAVA COM ÓDIO DE VENCER!* 🔥😂\n_Ódio? Não, RAIVA, FÚRIA, VONTADE DE HUMILHAR! Cada palavra era um golpe, cada frase um nocaute, cada mensagem um pedido de aposentadoria pros outros!_ 👊😂',

  '👑👸🏻 *RAINHA ABSOLUTA SEM DISCUSSÃO!* 👸🏻👑\n_Nem o ChatGPT consegue competir com esse nível de dominância! A IA pediu pra não ser comparada porque "não atingiu esse patamar ainda"._ 🤖😂',

  '🤣💥 *HOJE ELA ALUGOU UM TRIPLEX NO TOPO!* 💥🤣\n_Com vista panorâmica pra humilhação, varanda gourmet do deboche e piscina aquecida da zoação! Os outros tão no subsolo alugando um cativeiro!_ 🏢😂',

  '🔥👑 *IMPARÁVEL, INCONTROLÁVEL E SEM LIMITES!* 👑🔥\n_Se fosse vírus, ninguém tomava vacina. Se fosse praga, ninguém reclamava. Se fosse pecado, tava todo mundo indo pro inferno feliz da vida!_ 😈😂',

  '😂👸🏻 *ELA FEZ HISTÓRIA HOJE... PODE ANOTAR!* 👸🏻😂\n_Os historiadores do futuro vão estudar esse dia e falar: "Foi ali que o grupo entrou em decadência total". Tintim por tintim!_ 📚😂',

  '👑💅 *SIMPLESMENTE OUTRA CATEGORIA!* 💅👑\n_Categoria "deuses do Olimpo", categoria "avatar da humilhação", categoria "não tem pra ninguém"! Enquanto vocês correm, ela já chegou, tomou banho e tá dormindo!_ 🏆😂',

  '🤣🔥 *HOJE ELA VEIO PRA TRABALHAR MESMO!* 🔥🤣\n_Trabalhou igual condenada à humilhação perpétua! Fez hora extra, dobrou turno, cobriu férias dos outros e ainda pediu pra fazer banco de horas!_ 💼😂',

  '👑💥 *ENCERRAMOS POR HOJE...* 💥👑\n_A VENCEDORA JÁ FOI DEFINIDA, O TROFÉU JÁ FOI ENTREGUE E A FESTA JÁ ACABOU! Vocês podem tentar de novo amanhã, mas aviso: ela já confirmou presença e pediu música no paredão!_ 🎤😂',
];

function fraseAleatoria() {
  return FRASES_RAINHA[Math.floor(Math.random() * FRASES_RAINHA.length)];
}

// ============================================================
//  Handler principal
// ============================================================

export async function rainhaHandler(client, message) {
  const grupoId = message.key.remoteJid;
  const userId  = message.key.participant || message.key.remoteJid;

  try {
    // 1️⃣ Verificar se é um grupo
    if (!grupoId.endsWith('@g.us')) {
      return client.sendMessage(grupoId, {
        text: `${NOME_GRUPO}\n\n❌ Este comando só funciona em grupos!`,
      });
    }

    // 2️⃣ Verificar se o usuário é administrador
    const isAdmin = await checkIfUserIsAdmin(client, grupoId, userId);

    if (!isAdmin) {
      // Deletar o comando do não-admin silenciosamente
      await deleteCommandMessage(client, grupoId, message.key);

      return client.sendMessage(grupoId, {
        text: `${NOME_GRUPO}\n\n❌ Apenas *administradores* podem usar o comando *#rainhadamas*!`,
      });
    }

    // 3️⃣ Buscar a rainha do dia
    const rainha = await getRainhaDoDia(grupoId);

    if (!rainha) {
      return client.sendMessage(grupoId, {
        text: `${NOME_GRUPO}\n\n👑 Ainda não há mensagens registradas hoje para eleger a Rainha do Dia!`,
      });
    }

    const mencao  = `${rainha.usuario_id}@s.whatsapp.net`;
    const legenda =
      `${NOME_GRUPO}\n\n` +
      `👑💎 *RAINHA DO DIA* 💎👑\n\n` +
      `@${rainha.usuario_id}\n\n` +
      `${fraseAleatoria()}\n\n` +
      `📊 *Mensagens hoje:* ${rainha.total}`;

    const fotoBuffer = await baixarImagem();

    if (fotoBuffer) {
      const enviado = await enviarComImagem(client, grupoId, fotoBuffer, legenda, [mencao]);
      if (enviado) return;
    }

    // Fallback: só texto com menção
    await client.sendMessage(grupoId, {
      text:     legenda,
      mentions: [mencao],
    });

  } catch (err) {
    console.error('[rainhaHandler] Erro:', err.message);
    await client.sendMessage(grupoId, {
      text: `${NOME_GRUPO}\n\n❌ Ocorreu um erro ao buscar a Rainha do Dia. Tente novamente!`,
    });
  }
}