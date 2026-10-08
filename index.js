const { Client, GatewayIntentBits } = require("discord.js");
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
    id: "UCPbyZugeRr0uILdWvh8WrPA"
  },
  {
    handle: "@zgameclipes",
    id: "UCcrdcEGehihSdSrUgs0RsHA"
  }
];

// Guarda os vídeos que já foram enviados
const videosEnviados = new Set();

async function verificarCanal(canalYT) {
  try {
    const channelId = canalYT.id;

    const feed = await parser.parseURL(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    );

    if (!feed.items || feed.items.length === 0) {
      return;
    }

    // Pega somente o vídeo mais recente
    const video = feed.items[0];

    // ID do vídeo
    let videoId = null;

    if (video.id) {
      videoId = video.id
        .replace("yt:video:", "")
        .trim();
    }

    // Tenta encontrar pelo link
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

    // Se já foi enviado, não envia novamente
    if (videosEnviados.has(videoId)) {
      return;
    }

    /*
     * Primeira inicialização:
     * registra o vídeo atual sem enviar.
     */
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

    // Link oficial do vídeo
    const videoLink =
      `https://www.youtube.com/watch?v=${videoId}`;

    /*
     * Marca como enviado ANTES de mandar.
     * Isso evita duplicações.
     */
    videosEnviados.add(videoId);

    /*
     * Mensagem normal.
     *
     * O Discord gera automaticamente
     * a prévia/thumbnail do YouTube.
     */
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

    console.log(
      `Novo vídeo enviado (${canalYT.handle}): ${