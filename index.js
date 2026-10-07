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

    // Descobre automaticamente o ID do @zechinxb
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

    // Primeiro acesso: registra o vídeo atual
    if (!ultimosVideos[canalYT.handle]) {
      ultimosVideos[canalYT.handle] = video.id;

      console.log(
        `Vídeo inicial registrado (${canalYT.handle}): ${video.title}`
      );

      return;
    }

    // Nada novo
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

    /*
     * Tenta descobrir o ID do vídeo de duas formas:
     *
     * 1. Pelo video.id do RSS
     * 2. Pelo link do vídeo
     */

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

    // Link oficial do vídeo
    const videoLink = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : video.link;

    // Thumbnail oficial do YouTube
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

    // Adiciona a thumbnail quando o ID foi encontrado
    if (thumbnail) {
      embed.setImage(thumbnail);
    }

    // Envia a divulgação
    await canalDiscord.send({
      content: "@everyone",
     