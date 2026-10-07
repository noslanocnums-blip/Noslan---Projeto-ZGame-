const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const Parser = require("rss-parser");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const parser = new Parser();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

const YOUTUBE_CHANNELS = [
  {
    handle: "@zechinxb",
    id: null
  },
  {
    handle: "@zgameclipes",
    id: "UCcrdcEGehihSdSrUgs0RsHA"
  }
];

const ultimosVideos = {};

async function verificarCanal(canalYT) {
  try {
    let channelId = canalYT.id;

    // Descobre automaticamente o ID do canal
    if (!channelId) {
      const pagina = await fetch(
        `https://www.youtube.com/${canalYT.handle}`
      ).then(res => res.text());

      const match = pagina.match(/"channelId":"(UC[^"]+)"/);

      if (!match) {
        console.log(
          `Não foi possível encontrar o canal ${canalYT.handle}.`
        );
        return;
      }

      channelId = match[1];
    }

    const feed = await parser.parseURL(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    );

    if (!feed.items || feed.items.length === 0) {
      return;
    }

    const video = feed.items[0];

    // Primeira verificação: apenas registra o vídeo atual
    if (!ultimosVideos[canalYT.handle]) {
      ultimosVideos[canalYT.handle] = video.id;

      console.log(
        `Vídeo inicial registrado (${canalYT.handle}): ${video.title}`
      );

      return;
    }

    // Não há vídeo novo
    if (video.id === ultimosVideos[canalYT.handle]) {
      return;
    }

    // Novo vídeo encontrado
    ultimosVideos[canalYT.handle] = video.id;

    const canalDiscord = await client.channels.fetch(
      DISCORD_CHANNEL_ID
    );

    if (!canalDiscord) {
      console.log("Canal do Discord não encontrado.");
      return;
    }

    // Tenta obter o ID do vídeo
    let videoId = null;

    if (video.id) {
      videoId = video.id
        .replace("yt:video:", "")
        .trim();
    }

    // Se não encontrou pelo ID, tenta pelo link
    if (!videoId || videoId.length !== 11) {
      const match = video.link?.match(
        /(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/
      );

      if (match) {
        videoId = match[1];
      }
    }

    // Link oficial
    const videoLink = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : video.link;

    // Thumbnail
    const thumbnail = videoId
      ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      : null;

    const embed = new EmbedBuilder()
      .setTitle("📢 Novo conteúdo no YouTube!")
      .setDescription(
        `**${video.title || "Novo vídeo no YouTube!"}**\n\nCanal: **${canalYT.handle}**`
      )
      .setURL(videoLink)
      .setTimestamp(
        video.pubDate ? new Date(video.pubDate) : new Date()
      )
      .setFooter({
        text: "ZGame • YouTube"
      });

    // Adiciona thumbnail
    if (thumbnail) {
      embed.setImage(thumbnail);
    }

    // Envia para o Discord
    await canalDiscord.send({
      content: "@everyone",
      embeds: [embed],
      allowedMentions: {
        parse: ["everyone"]
      }
    });

    console.log(
      `Novo conteúdo enviado (${canalYT.handle}): ${video.title}`
    );

    console.log(
      `ID do vídeo: ${videoId || "não encontrado"}`
    );

    console.log(
      `Link: ${videoLink}`
    );

  } catch (erro) {
    console.error(
      `Erro ao verificar ${canalYT.handle}: ${erro.message}`
    );
  }
}

async function verificarYouTube() {
  for (const canal of YOUTUBE_CHANNELS) {
    await verificarCanal(canal);
  }
}

client.once("ready", async () => {
  console.log(`Online como ${client.user.tag}`);

  // Primeira verificação
  await verificarYouTube();

  // Verifica a cada 30 segundos
  setInterval(verificarYouTube, 30 * 1000);
});

client.login(DISCORD_TOKEN);