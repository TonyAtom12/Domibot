const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DATA_PATH = path.join(__dirname, '..', 'data', 'wars.json');
const IMAGE_FOLDER = path.join(__dirname, '..', 'data', 'images');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('registrarwar')
    .setDescription('Registrar una nueva war'),

  async execute(interaction) {

    const channel = interaction.channel;
    const userId = interaction.user.id;

    if (!fs.existsSync(DATA_PATH)) {
      return interaction.reply('⚠ No existe wars.json.');
    }

    await interaction.reply('📌 Registro de War iniciado.');

    function waitForMessage(filter, time = 60000) {
      return new Promise((resolve, reject) => {
        const collector = channel.createMessageCollector({
          filter,
          max: 1,
          time
        });

        collector.on('collect', m => resolve(m));
        collector.on('end', collected => {
          if (!collected.size) reject(new Error('timeout'));
        });
      });
    }

    try {

      // 1️⃣ Rival
      await channel.send('Escribe el nombre del rival:');
      const rivalMsg = await waitForMessage(m => m.author.id === userId);
      const rival = rivalMsg.content.trim();

      // 2️⃣ Puntos nuestro equipo
      await channel.send('💯 Puntos de nuestro equipo:');
      const nuestroMsg = await waitForMessage(m => m.author.id === userId);
      const nuestro = Number(nuestroMsg.content.replace(/[^\d]/g, ''));
      if (isNaN(nuestro)) return channel.send('⚠ Número inválido.');

      // 3️⃣ Puntos rival
      await channel.send('🔴 Puntos del rival:');
      const rivalPtsMsg = await waitForMessage(m => m.author.id === userId);
      const rivalPuntos = Number(rivalPtsMsg.content.replace(/[^\d]/g, ''));
      if (isNaN(rivalPuntos)) return channel.send('⚠ Número inválido.');

      // 4️⃣ Imagen (BLOQUE CORREGIDO)
      await channel.send('🖼 Adjunta ahora la imagen de la war.');

      const imgMsg = await new Promise((resolve, reject) => {

        const collector = channel.createMessageCollector({
          time: 60000
        });

        collector.on('collect', m => {
          if (m.author.id !== userId) return;

          if (m.attachments.size > 0) {
            collector.stop();
            resolve(m);
          }
        });

        collector.on('end', collected => {
          if (!collected.size) reject(new Error('timeout'));
        });

      });

      const attachment = imgMsg.attachments.first();

      if (!fs.existsSync(IMAGE_FOLDER)) {
        fs.mkdirSync(IMAGE_FOLDER, { recursive: true });
      }

      const data = JSON.parse(fs.readFileSync(DATA_PATH));
      const date = new Date().toISOString().split('T')[0];
      const countToday = data.wars.filter(w => w.fecha === date).length + 1;
      const id = `${date}_${String(countToday).padStart(3, '0')}`;
      const imagePath = path.join(IMAGE_FOLDER, `${id}.png`);

      const response = await axios({
        url: attachment.url,
        responseType: 'stream'
      });

      await new Promise((resolve, reject) => {
        const stream = response.data.pipe(fs.createWriteStream(imagePath));
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      // 5️⃣ Jugadores
      await channel.send('👤 Añade jugadores así:\n@usuario 120\nEscribe `fin` cuando termines.');

      let jugadores = [];

      while (true) {

        const playerMsg = await waitForMessage(m => m.author.id === userId, 120000);
        const content = playerMsg.content.trim();

        if (content.toLowerCase() === 'fin') break;

        const user = playerMsg.mentions.users.first();
        const parts = content.split(' ');
        const puntos = Number(parts[1]);

        if (!user || isNaN(puntos)) {
          await channel.send('⚠ Formato incorrecto.');
          continue;
        }

        if (jugadores.some(j => j.discordId === user.id)) {
          await channel.send('⚠ Ese jugador ya fue añadido.');
          continue;
        }

        jugadores.push({
          discordId: user.id,
          puntos,
          titular: true
        });

        await channel.send(`✔ Añadido ${user.username} (${puntos} pts)`);
      }

      const suma = jugadores.reduce((a, b) => a + b.puntos, 0);

      if (suma !== nuestro) {
        return channel.send(`⚠ La suma (${suma}) no coincide con el total (${nuestro}).`);
      }

      data.wars.push({
        id,
        fecha: date,
        timestamp: Date.now(),
        rival,
        resultado: {
          nuestroEquipo: nuestro,
          rival: rivalPuntos,
          diferencia: nuestro - rivalPuntos,
          victoria: nuestro > rivalPuntos
        },
        imagen: `data/images/${id}.png`,
        jugadores
      });

      if (!data.rivales.includes(rival)) {
        data.rivales.push(rival);
      }

      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));

      channel.send('✅ War registrada correctamente.');

    } catch (err) {
      console.error(err);
      channel.send('⏱ Registro cancelado por inactividad.');
    }
  }
};
