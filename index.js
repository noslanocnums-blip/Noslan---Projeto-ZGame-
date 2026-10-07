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

    if (!ultimosVideos[canalYT.handle]) {
      ultimosVideos[canalYT.handle] = video.id;

      console.log(
        `Vídeo inicial registrado (${canalYT.handle}): ${video.title}`
      );

      return;
    }

    if (video.id === ultimosVideos[canalYT.handle]) {
      return;
    }

    ultimosVideos[canalYT.handle] = video.id;

    const canalDiscord = await client.channels.fetch(
      DISCORD_CHANNEL_ID
    );

    if (!canalDiscord) {
      console.log("Canal do Discord não encontrado.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("📢 Novo conteúdo no YouTube!")
      .setDescription(
        `**${video.title}**\n\nCanal: **${canalYT.handle}**`
      )
      .setURL(video.link)
      .setTimestamp(new Date(video.pubDate))
      .setFooter({
        text: "ZGame • YouTube"
      });

    await canalDiscord.send({
      embeds: [embed]
    });

    console.log(
      `Novo conteúdo enviado (${canalYT.handle}): ${video.title}`
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

  await verificarYouTube();

  setInterval(verificarYouTube, 60 * 1000);
});

client.login(DISCORD_TOKEN);