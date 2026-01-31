const cron = require('node-cron');

module.exports = (client) => {
  // ⏰ Todos los domingos a las 17:00
  cron.schedule('0 17 * * 0', async () => {
    try {
      const channelId = 'ID_DEL_CANAL_AQUI';
      const channel = await client.channels.fetch(channelId);
      if (!channel) return;

      const horariosCommand = client.commands.get('horarios');
      if (!horariosCommand) return;

      await horariosCommand.execute({ channel });
      console.log('✅ Cron de horarios ejecutado');
    } catch (error) {
      console.error('❌ Error en cron de horarios:', error);
    }
  });
};
