
    const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const Parser = require("rss-parser");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
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
// REGISTRAR COMANDO /SITE
// =========================

async function registrarComandoSite() {
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

  const comando = new SlashCommandBuilder()
    .setName("site")
    .setDescription("Divulga o site do ZGame")
    .toJSON();

  try {
    const existentes = await rest.get(rota);

    const comandoExistente = existentes.find(
      c => c.name === "site"
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

    console.log("Comando /site registrado com sucesso!");
  } catch (erro) {
    console.error(
      "Erro ao registrar o comando /site:",
      erro
    );
  }
}

// =========================
// EXECUTAR COMANDO /SITE
// =========================

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "site") return;

  // Permitir somente no canal configurado
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
        content: "Não consegui publicar o site. Confira as permissões do bot.",
        ephemeral: true
      });
    }
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

    // =========================
    // DETECÇÃO DE LIVE
    // =========================

    const liveStatus =
      video.liveBroadcastContent || "none";

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

    // =========================
    // SISTEMA DE VÍDEOS
    // =========================

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

  await registrarComandoSite();
  await verificarYouTube();

  setInterval(
    verificarYouTube,
    30 * 1000
  );
});

client.login(DISCORD_TOKEN);