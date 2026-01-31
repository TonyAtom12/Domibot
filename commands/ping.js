const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Comprueba si Domibot está vivo'),

  async execute(interaction) {
    await interaction.reply('🏓 Pong!');
  }
};
