const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const MAX_WAR_PLAYERS = 6;

const WAR_ROLE_IDS = [
  '1379816348259188868',
  '1379816773360029766',
  '1379816905283735625'
];

const globalWars = {};
let globalMessage = null;

// 🔒 Mapeo usando claves normalizadas
const STATUS = new Map([
  ['✅', 'puede'],
  ['❌', 'noPuede'],
  ['❓', 'posible'],
  ['❗', 'sub']
]);

const WAR_HOURS = [16, 17, 18, 19, 20, 21, 22, 23, 24];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('horarios')
    .setDescription('Publica las wars por hora con control de asistencia'),

  async execute(context) {
    const channel = context.channel;
    if (!channel) return;

    for (const hour of WAR_HOURS) {
      await createWar(channel, hour);
    }
  }
};

// =====================================================
// 🧠 CREAR WAR
// =====================================================
async function createWar(channel, hour) {

  const state = {
    puede: [],
    noPuede: [],
    posible: [],
    sub: [],
    drop: []
  };

  globalWars[hour] = state;

  const render = () => {
    const format = list =>
      list.length ? list.map(u => `• ${u}`).join('\n') : null;

    const confirmed = state.puede.length + state.sub.length;
    const remaining = Math.max(0, MAX_WAR_PLAYERS - confirmed);

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ War ${hour}:00 (${confirmed}/${MAX_WAR_PLAYERS})`)
      .setColor(confirmed >= MAX_WAR_PLAYERS ? 0xff5555 : 0x2ecc71)
      .setDescription(`Faltan **${remaining}** para completar la war`);

    if (state.puede.length)
      embed.addFields({ name: `✅ Puede (${state.puede.length})`, value: format(state.puede) });

    if (state.noPuede.length)
      embed.addFields({ name: `❌ No puede (${state.noPuede.length})`, value: format(state.noPuede) });

    if (state.posible.length)
      embed.addFields({ name: `❓ Posible (${state.posible.length})`, value: format(state.posible) });

    if (state.sub.length)
      embed.addFields({ name: `❗ Puede ser sub (${state.sub.length})`, value: format(state.sub) });

    if (state.drop.length)
      embed.addFields({ name: `💥 Drop (${state.drop.length})`, value: format(state.drop) });

    return embed;
  };

  const message = await channel.send({ embeds: [render()] });

  // 🔒 Añadir reacciones base
  for (const emoji of STATUS.keys()) {
    await message.react(emoji);
  }

  // 🔒 Filtrado fuerte + ignorar bots
  const collector = message.createReactionCollector({
    dispose: true,
    filter: (reaction, user) =>
      !user.bot &&
      reaction.emoji.name &&
      STATUS.has(reaction.emoji.name.normalize())
  });

  const updateUser = (user, rawEmoji) => {

    if (!rawEmoji) return;

    const emoji = rawEmoji.normalize();

    if (!STATUS.has(emoji)) return;

    const statusKey = STATUS.get(emoji);
    if (!statusKey) return;

    const tag = `<@${user.id}>`;
    const wasInPuede = state.puede.includes(tag);

    // 🔒 Eliminar usuario de todas las listas
    for (const list of Object.values(state)) {
      const i = list.indexOf(tag);
      if (i !== -1) list.splice(i, 1);
    }

    // 🔒 Caso especial drop
    if (emoji === '❌' && wasInPuede) {
      if (!state.drop.includes(tag)) {
        state.drop.push(tag);
      }
      return;
    }

    if (!state[statusKey]) return;

    if (!state[statusKey].includes(tag)) {
      state[statusKey].push(tag);
    }
  };

  collector.on('collect', async (reaction, user) => {

    const emojiUsed = reaction.emoji.name;
    if (!emojiUsed) return;

    // 🔒 Eliminar otras reacciones del usuario
    for (const emoji of STATUS.keys()) {
      if (emoji !== emojiUsed.normalize()) {
        const r = message.reactions.cache.get(emoji);
        if (r) await r.users.remove(user.id).catch(() => {});
      }
    }

    updateUser(user, emojiUsed);
    await message.edit({ embeds: [render()] });
    await updateGlobalStatus(channel);
  });

  collector.on('remove', async (reaction, user) => {

    if (user.bot) return;

    const tag = `<@${user.id}>`;

    for (const list of Object.values(state)) {
      const i = list.indexOf(tag);
      if (i !== -1) list.splice(i, 1);
    }

    await message.edit({ embeds: [render()] });
    await updateGlobalStatus(channel);
  });
}

// =====================================================
// 📣 GLOBAL STATUS
// =====================================================
async function updateGlobalStatus(channel) {

  let text = `📣 **Actualización de Wars**\n\n`;

  let hasAny = false;

  for (const hour of Object.keys(globalWars).sort((a, b) => a - b)) {

    const state = globalWars[hour];
    const confirmed = state.puede.length + state.sub.length;
    const remaining = Math.max(0, MAX_WAR_PLAYERS - confirmed);

    // 🔥 Solo mostrar si faltan 3 o menos
    if (remaining <= 4 && remaining > 0) {
      hasAny = true;
      text += `🕒 **${hour}:00** → ⏳ ${remaining} plazas libres\n`;
    }
  }

  if (!hasAny) {
    text += `✅ No hay wars cercanas a completarse.\n`;
  }

  if (!globalMessage) {
    globalMessage = await channel.send({ content: text });
  } else {
    await globalMessage.edit({ content: text });
  }
}

