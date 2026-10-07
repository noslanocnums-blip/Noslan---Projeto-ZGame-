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

// Guarda os vídeos que já foram enviados
const videosEnviados = new Set();

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
          `Não foi possível encontrar ${canalYT.handle}`
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

    /*
     * IMPORTANTE:
     * O RSS pode retornar vários vídeos.
     *
     * Nós só analisamos o vídeo mais recente.
     */
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

    /*
     * Se esse vídeo já foi enviado,
     * não envia novamente.
     */
    if (videosEnviados.has(videoId)) {
      return;
    }

    /*
     * Primeira inicialização:
     * registra o vídeo atual sem mandar mensagem.
     *
     * Isso evita que o bot mande vídeos antigos
     * quando reinicia.
     */
    if (!videosEnviados.has(`INICIADO_${canalYT.handle}`)) {

      videosEnviados.add(`INICIADO_${canalYT.handle}`);
      videosEnviados.add(videoId);

      console.log(
        `Vídeo atual registrado (${canalYT.handle}): ${video.title}`
      );

      return;
    }

    // Marca como enviado antes de mandar
    videosEnviados.add(videoId);

    const canalDiscord = await client.channels.fetch(
      DISCORD_CHANNEL_ID
    );

    if (!canalDiscord) {
      console.log("Canal do Discord não encontrado.");
      return;
    }

    /*
     * LINK DO VÍDEO
     */
    const videoLink =
      `https://www.youtube.com/watch?v=${videoId}`;

    /*
     * THUMBNAIL
     *
     * Primeiro tenta usar a thumbnail que o RSS
     * fornece.
     */
    let thumbnail = null;

    if (
      video.media &&
      video.media.thumbnail &&
      video.media.thumbnail.$
    ) {
      thumbnail = video.media.thumbnail.$.url;
    }

    /*
     * Algumas versões do rss-parser podem colocar
     * a thumbnail diretamente aqui.
     */
    if (
      !thumbnail &&
      video["media:thumbnail"] &&
      video["media:thumbnail"]["$"]
    ) {
      thumbnail = video["media:thumbnail"]["$"].url;
    }

    /*
     * Fallback para a thumbnail oficial do YouTube.
     */
    if (!thumbnail) {
      thumbnail =
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }

    const embed = new EmbedBuilder()
      .setTitle("📢 Novo conteúdo no YouTube!")
      .setDescription(
        `**${video.title || "Novo vídeo!"}**\n\n` +
        `Canal: **${canalYT.handle}**`
      )
      .setURL(videoLink)
      .setImage(thumbnail)
      .setTimestamp(
        video.pubDate
          ? new Date(video.pubDate)
          : new Date()
      )
      .setFooter({
        text: "ZGame • YouTube"
      });

    await canalDiscord.send({
      content: "@everyone",
      embeds: [embed],
      allowedMentions: {
        parse: ["everyone"]
      }
    });

    console.log(
      `Novo vídeo enviado: ${video.title}`
    );

    console.log(
      `ID: ${videoId}`
    );

    console.log(
      `Thumbnail: ${thumbnail}`
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

  console.log(
    `Online como ${client.user.tag}`
  );

  await verificarYouTube();

  setInterval(
    verificarYouTube,
    30 * 1000
  );

});

client.login(DISCORD_TOKEN);