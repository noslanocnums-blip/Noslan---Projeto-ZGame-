const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const Parser = require("rss-parser");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const parser = new Parser();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

const YOUTUBE_HANDLES = [
  "@zechinxb",
  "@zgameclipes"
];

const ultimosVideos = {};

async function verificarCanal(handle) {
  try {
    // Descobre automaticamente o ID do canal através do @handle
    const pagina = await fetch(
      `https://www.youtube.com/${handle}`
    ).then(res => res.text());

    const match = pagina.match(/"channelId":"(UC[^"]+)"/);

    if (!match) {
      console.log(`Não foi possível encontrar o canal ${handle}.`);
      return;
    }

    const channelId = match[1];

    const feed = await parser.parseURL(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    );

    if (!feed.items || feed.items.length === 0) return;

    const video = feed.items[0];

    // Primeiro acesso: registra o vídeo atual sem enviar notificação
    if (!ultimosVideos[handle]) {
      ultimosVideos[handle] = video.id;
      console.log(
        `Vídeo inicial registrado (${handle}): ${video.title}`
      );
      return;
    }

    // Nada novo
    if (video.id === ultimosVideos[handle]) return;

    // Atualiza o último vídeo
    ultimosVideos[handle] = video.id;

    const canal = await client.channels.fetch(DISCORD_CHANNEL_ID);

    if (!canal) {
      console.log("Canal do Discord não encontrado.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("📢 Novo conteúdo no YouTube!")
      .setDescription(
        `**${video.title}**\n\nCanal: **${handle}**`
      )
      .setURL(video.link)
      .setTimestamp(new Date(video.pubDate))
      .setFooter({ text: "ZGame • YouTube" });

    await canal.send({ embeds: [embed] });

    console.log(
      `Novo conteúdo enviado (${handle}): ${video.title}`
    );

  } catch (erro) {
    console.error(
      `Erro ao verificar ${handle}:`,
      erro.message
    );
  }
}

async function verificarYouTube() {
  for (const handle of YOUTUBE_HANDLES) {
    await verificarCanal(handle);
  }
}

client.once("ready", async () => {
  console.log(`Online como ${client.user.tag}`);

  await verificarYouTube();

  setInterval(verificarYouTube, 60 * 1000);
});

client.login(DISCORD_TOKEN);