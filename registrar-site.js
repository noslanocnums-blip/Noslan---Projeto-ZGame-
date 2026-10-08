
const {
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const commands = [
  new SlashCommandBuilder()
    .setName("site")
    .setDescription("Divulga o site do ZGame")
    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(token);

async function registrar() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log("Comando /site registrado com sucesso!");
  } catch (erro) {
    console.error("Erro ao registrar:", erro);
  }
}

registrar();
