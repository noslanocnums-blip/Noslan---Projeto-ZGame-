
const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const Parser = require("rss-parser");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// =========================
// CONFIGURAÇÃO DO BOT
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const parser = new Parser({
  customFields: {
    item: [
      ["yt:liveBroadcastContent", "liveBroadcastContent"]
    ]
  }
});

// =========================
// VARIÁVEIS DE AMBIENTE
// =========================

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const SITE_CHANNEL_ID = process.env.SITE_CHANNEL_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const SITE_URL = "https://zgame-jogos-mobile.netlify.app/";

const TUTORIAL_URL =
  "https://youtube.com/shorts/5mICKOKDADo?si=YqLW_eCPqEWakYJL";

const YOUTUBE_CHANNELS = [
  {
    handle: "@zechinxb",
    id: "UCPbyZugeRr0uILdWvh8WrPA"
  },
  {
    handle: "@zgameclipes",
    id: "UCcrdcEGehihSdSrUgs0RsHA"
  }
];

const videosEnviados = new Set();
const livesEnviadas = new Set();

// =========================
// DETECTOR DE IMAGENS
// =========================

// As quatro referências devem estar nesta pasta.
const PASTA_REFERENCIAS = path.join(__dirname, "references");

const ARQUIVOS_REFERENCIAS = [
  "ref1.png",
  "ref2.png",
  "ref3.png",
  "ref4.png"
];

// Quanto maior o valor, mais parecidas as imagens
// precisam ser para serem consideradas correspondentes.
const LIMITE_SIMILARIDADE = 0.92;

// Todas as imagens são normalizadas para o mesmo tamanho.
const TAMANHO_COMPARACAO = 32;

let referenciasVisuais = [];
let detectorPronto = false;

async function extrairPixels(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(TAMANHO_COMPARACAO, TAMANHO_COMPARACAO, {
      fit: "fill"
    })
    .removeAlpha()
    .toColourspace("srgb")
    .raw()
    .toBuffer();
}

async function carregarReferencias() {
  referenciasVisuais = [];

  for (const nomeArquivo of ARQUIVOS_REFERENCIAS) {
    const caminho = path.join(PASTA_REFERENCIAS, nomeArquivo);

    if (!fs.existsSync(caminho)) {
      console.warn(
        `[Detector] Referência não encontrada: ${caminho}`
      );
      continue;
    }

    try {
      const buffer = fs.readFileSync(caminho);
      const pixels = await extrairPixels(buffer);

      referenciasVisuais.push({
        nome: nomeArquivo,
        pixels
      });

      console.log(`[Detector] Referência carregada: ${nomeArquivo}`);
    } catch (erro) {
      console.error(
        `[Detector] Erro ao carregar ${nomeArquivo}:`,
        erro.message
      );
    }
  }

  detectorPronto = referenciasVisuais.length > 0;

  if (!detectorPronto) {
    console.warn(
      "[Detector] Nenhuma referência foi carregada. " +
      "A detecção de imagens ficará desativada."
    );
  } else {
    console.log(
      `[Detector] Pronto com ${referenciasVisuais.length} referência(s).`
    );
  }
}

// Compara a diferença média entre os pixels.
// Retorna um valor entre 0 e 1.
// 1 significa pixels iguais; valores menores indicam diferenças.
function calcularSimilaridade(pixelsA, pixelsB) {
  if (pixelsA.length !== pixelsB.length || pixelsA.length === 0) {
    return 0;
  }

  let diferencaTotal = 0;

  for (let i = 0; i < pixelsA.length; i++) {
    diferencaTotal += Math.abs(pixelsA[i] - pixelsB[i]);
  }

  const diferencaMedia =
    diferencaTotal / pixelsA.length;

  return 1 - diferencaMedia / 255;
}

async function verificarImagem(buffer) {
  if (!detectorPronto) {
    return {
      encontrada: false,
      motivo: "detector_indisponivel"
    };
  }

  try {
    const pixelsImagem = await extrairPixels(buffer);

    let melhorCorrespondencia = {
      encontrada: false,
      referencia: null,
      similaridade: 0
    };

    for (const referencia of referenciasVisuais) {
      const similaridade = calcularSimilaridade(
        pixelsImagem,
        referencia.pixels
      );

      if (similaridade > melhorCorrespondencia.similaridade) {
        melhorCorrespondencia = {
          encontrada: similaridade >= LIMITE_SIMILARIDADE,
          referencia: referencia.nome,
          similaridade
        };
      }
    }

    return melhorCorrespondencia;
  } catch (erro) {
    console.error(
      "[Detector] Não foi possível analisar uma imagem:",
      erro.message
    );

    return {
      encontrada: false,
      motivo: "erro_ao_analisar"
    };
  }
}

function pareceImagem(attachment) {
  const tipo = attachment.contentType || "";

  if (tipo.startsWith("image/")) {
    return true;
  }

  return /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(
    attachment.name || ""
  );
}

// Verifica todas as imagens da mensagem.
client.on(Events.MessageCreate, async (message) => {
  if (!message.guild || message.author.bot) return;
  if (!message.attachments.size) return;
  if (!detectorPronto) return;

  const anexos = [...message.attachments.values()]
    .filter(pareceImagem);

  if (anexos.length === 0) return;

  for (const anexo of anexos) {
    try {
      const resposta = await fetch(anexo.url);

      if (!resposta.ok) {
        console.warn(
          `[Detector] Falha ao baixar ${anexo.name}: HTTP ${resposta.status}`
        );
        continue;
      }

      const arrayBuffer = await resposta.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Evita tentar processar arquivos excessivamente grandes.
      if (buffer.length > 15 * 1024 * 1024) {
        console.warn(
          `[Detector] Imagem muito grande, ignorada: ${anexo.name}`
        );
        continue;
      }

      const resultado = await verificarImagem(buffer);

      if (!resultado.encontrada) continue;

      console.log(
        `[Detector] Correspondência encontrada: ${anexo.name} ` +
        `com ${resultado.referencia} ` +
        `(${(resultado.similaridade * 100).toFixed(1)}%)`
      );

      // Apaga a mensagem inteira, inclusive outros anexos.
      try {
        await message.delete();
      } catch (erro) {
        console.error(
          "[Detector] Não consegui apagar a mensagem. " +
          "Verifique a permissão Gerenciar mensagens:",
          erro.message
        );

        return;
      }

      // Avisa no canal depois de remover a mensagem.
      try {
        const aviso = await message.channel.send({
          content:
            `⚠️ <@${message.author.id}>, sua mensagem foi removida ` +
            "porque uma imagem correspondeu a uma referência proibida.",
          allowedMentions: {
            users: [message.author.id]
          }
        });

        // Tenta apagar o aviso após 10 segundos.
        setTimeout(() => {
          aviso.delete().catch(() => {});
        }, 10_000);
      } catch (erro) {
        console.error(
          "[Detector] Não consegui enviar o aviso:",
          erro.message
        );
      }

      return;
    } catch (erro) {
      console.error(
        `[Detector] Erro ao verificar ${anexo.name}:`,
        erro.message
      );
    }
  }
});

// =========================
// REGISTRAR COMANDOS
// =========================

async function registrarComandos() {
  if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
    console.error(
      "Faltam as variáveis DISCORD_TOKEN, CLIENT_ID ou GUILD_ID."
    );
    return;
  }

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  const rota = Routes.applicationGuildCommands(
    CLIENT_ID,
    GUILD_ID
  );

  const comandos = [
    new SlashCommandBuilder()
      .setName("site")
      .setDescription("Divulga o site do ZGame")
      .toJSON(),

    new SlashCommandBuilder()
      .setName("tutorial")
      .setDescription("Envia o link do tutorial no YouTube")
      .toJSON()
  ];

  try {
    const existentes = await rest.get(rota);

    for (const comando of comandos) {
      const comandoExistente = existentes.find(
        c => c.name === comando.name
      );

      if (comandoExistente) {
        await rest.patch(
          Routes.applicationGuildCommand(
            CLIENT_ID,
            GUILD_ID,
            comandoExistente.id
          ),
          { body: comando }
        );
      } else {
        await rest.post(rota, { body: comando });
      }

      console.log(`Comando /${comando.name} registrado!`);
    }
  } catch (erro) {
    console.error("Erro ao registrar comandos:", erro);
  }
}

// =========================
// EXECUTAR COMANDOS
// =========================

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // COMANDO /SITE
  if (interaction.commandName === "site") {
    if (
      !SITE_CHANNEL_ID ||
      interaction.channelId !== SITE_CHANNEL_ID
    ) {
      await interaction.reply({
        content: "Use este comando somente no canal #jogos-mobile.",
        ephemeral: true
      });
      return;
    }

    try {
      await interaction.channel.send(
        "🌐 Confira o site do ZGame e veja os jogos disponíveis!\n\n" +
        SITE_URL
      );

      await interaction.reply({
        content: "Site divulgado com sucesso!",
        ephemeral: true
      });
    } catch (erro) {
      console.error("Erro ao divulgar o site:", erro);

      if (!interaction.replied) {
        await interaction.reply({
          content:
            "Não consegui publicar o site. Confira as permissões do bot.",
          ephemeral: true
        });
      }
    }

    return;
  }

  // COMANDO /TUTORIAL
  if (interaction.commandName === "tutorial") {
    try {
      await interaction.reply(
        "🎮 **Tutorial do YouTube:**\n" + TUTORIAL_URL
      );
    } catch (erro) {
      console.error("Erro ao enviar o tutorial:", erro);
    }

    return;
  }
});

// =========================
// VERIFICAR CANAL DO YOUTUBE
// =========================

async function verificarCanal(canalYT) {
  try {
    const channelId = canalYT.id;

    const feed = await parser.parseURL(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    );

    if (!feed.items || feed.items.length === 0) {
      return;
    }

    const video = feed.items[0];

    let videoId = null;

    if (video.id) {
      videoId = video.id
        .replace("yt:video:", "")
        .trim();
    }

    if (!videoId || videoId.length !== 11) {
      const match = video.link?.match(
        /(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/
      );

      if (match) {
        videoId = match[1];
      }
    }

    if (!videoId) {
      console.log(
        `Não foi possível encontrar o ID de ${canalYT.handle}`
      );
      return;
    }

    // DETECÇÃO DE LIVE
    const liveStatus = video.liveBroadcastContent || "none";

    if (
      canalYT.handle === "@zechinxb" &&
      liveStatus === "live"
    ) {
      if (!livesEnviadas.has(videoId)) {
        const canalDiscord = await client.channels.fetch(
          DISCORD_CHANNEL_ID
        );

        if (!canalDiscord) {
          console.log("Canal do Discord não encontrado.");
          return;
        }

        const videoLink =
          `https://www.youtube.com/watch?v=${videoId}`;

        await canalDiscord.send({
          content:
            `@everyone\n\n` +
            `🔴 **O @zechinxb está AO VIVO!**\n\n` +
            `**${video.title || "Live iniciada!"}**\n\n` +
            `👉 ${videoLink}`,
          allowedMentions: {
            parse: ["everyone"]
          }
        });

        livesEnviadas.add(videoId);

        console.log(`LIVE detectada: ${video.title}`);
      }
    }

    // SISTEMA DE VÍDEOS
    if (videosEnviados.has(videoId)) {
      return;
    }

    if (!videosEnviados.has(`INICIADO_${canalYT.handle}`)) {
      videosEnviados.add(`INICIADO_${canalYT.handle}`);
      videosEnviados.add(videoId);

      console.log(
        `Vídeo atual registrado (${canalYT.handle}): ${video.title}`
      );

      return;
    }

    const canalDiscord = await client.channels.fetch(
      DISCORD_CHANNEL_ID
    );

    if (!canalDiscord) {
      console.log("Canal do Discord não encontrado.");
      return;
    }

    const videoLink =
      `https://www.youtube.com/watch?v=${videoId}`;

    await canalDiscord.send({
      content:
        `@everyone\n\n` +
        `🔴 **O ${canalYT.handle} acabou de postar!**\n\n` +
        `**${video.title || "Novo vídeo!"}**\n\n` +
        `👉 ${videoLink}`,
      allowedMentions: {
        parse: ["everyone"]
      }
    });

    videosEnviados.add(videoId);

    console.log(
      `Novo vídeo enviado (${canalYT.handle}): ${video.title}`
    );

  } catch (erro) {
    console.error(
      `Erro ao verificar ${canalYT.handle}: ${erro.message}`
    );
  }
}

// =========================
// VERIFICAR TODOS OS CANAIS
// =========================

async function verificarYouTube() {
  for (const canal of YOUTUBE_CHANNELS) {
    await verificarCanal(canal);
  }
}

// =========================
// BOT ONLINE
// =========================

client.once(Events.ClientReady, async () => {
  console.log(`Online como ${client.user.tag}`);

  client.user.setActivity("GTA6 ⭐⭐⭐⭐⭐⭐");

  await carregarReferencias();
  await registrarComandos();
  await verificarYouTube();

  setInterval(
    verificarYouTube,
    30 * 1000
  );
});

client.login(DISCORD_TOKEN);