require('dotenv').config();
const fs = require('fs');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

const cron = require('node-cron');

const { Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

// Cargar comandos
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

client.once('clientReady', () => {
  console.log(`🤖 Domibot conectado como ${client.user.tag}`);

  // ⏰ Cron de horarios (ejemplo: domingos a las 17:00)
  cron.schedule('0 6 * * *', async () => {
    try {
      const channelId = '1379827783282196720'; // <-- pon el ID real
      const channel = await client.channels.fetch(channelId);
      if (!channel) return;

      const horariosCommand = client.commands.get('horarios');
      if (!horariosCommand) {
        console.error('❌ Comando horarios no encontrado');
        return;
      }

      await horariosCommand.execute({ channel });
      console.log('✅ Cron de horarios ejecutado');
    } catch (error) {
      console.error('❌ Error en cron de horarios:', error);
    }
  });
});


// Escuchar slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: '❌ Error ejecutando el comando', ephemeral: true });
    } else {
      await interaction.reply({ content: '❌ Error ejecutando el comando', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
