const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const MAX_WAR_PLAYERS = 6;

// 🔔 ROLES A NOTIFICAR
const WAR_ROLE_IDS = [
  '1379816348259188868',
  '1379816773360029766',
  '1379816905283735625'
];

const globalWars = {};
let globalMessage = null;

const STATUS = {
  '✅': 'puede',
  '❌': 'noPuede',
  '❓': 'posible',
  '❗': 'sub'
};

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
// 🧠 FUNCIÓN PRINCIPAL DE WAR (una por hora)
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

    const hasAny =
      state.puede.length ||
      state.noPuede.length ||
      state.posible.length ||
      state.sub.length ||
      state.drop.length;

    if (!hasAny) return embed;

    if (state.puede.length)
      embed.addFields({
        name: `✅ Puede (${state.puede.length})`,
        value: format(state.puede),
        inline: false
      });

    if (state.noPuede.length)
      embed.addFields({
        name: `❌ No puede (${state.noPuede.length})`,
        value: format(state.noPuede),
        inline: false
      });

    if (state.posible.length)
      embed.addFields({
        name: `❓ Posible (${state.posible.length})`,
        value: format(state.posible),
        inline: false
      });

    if (state.sub.length)
      embed.addFields({
        name: `❗ Puede ser sub (${state.sub.length})`,
        value: format(state.sub),
        inline: false
      });

    if (state.drop.length)
      embed.addFields({
        name: `💥 Drop (${state.drop.length})`,
        value: format(state.drop),
        inline: false
      });

    return embed;
  };

  const message = await channel.send({ embeds: [render()] });

  for (const emoji of Object.keys(STATUS)) {
    await message.react(emoji);
  }

  const collector = message.createReactionCollector({ dispose: true });

  const updateUser = (user, emoji) => {
    const tag = `<@${user.id}>`;
    const wasInPuede = state.puede.includes(tag);

    Object.values(state).forEach(list => {
      const i = list.indexOf(tag);
      if (i !== -1) list.splice(i, 1);
    });

    if (emoji === '❌' && wasInPuede) {
      state.drop.push(tag);
      return;
    }

    state[STATUS[emoji]].push(tag);
  };

  collector.on('collect', async (reaction, user) => {
    if (user.bot) return;

    const emojiUsed = reaction.emoji.name;

    for (const emoji of Object.keys(STATUS)) {
      if (emoji !== emojiUsed) {
        const r = message.reactions.cache.get(emoji);
        if (r) await r.users.remove(user.id).catch(() => {});
      }
    }

    updateUser(user, emojiUsed);
    await message.edit({ embeds: [render()] });
    await updateGlobalStatus(channel);
  });

  collector.on('remove', async () => {
    await message.edit({ embeds: [render()] });
  });
}

// =====================================================
// 📣 MENSAJE GLOBAL DE ESTADO (3 ROLES)
// =====================================================
async function updateGlobalStatus(channel) {
  const mentions = WAR_ROLE_IDS.map(id => `<@&${id}>`).join(' ');

  let text = `${mentions} 📣 **Actualización de Wars**\n\n`;

  for (const hour of Object.keys(globalWars).sort()) {
    const state = globalWars[hour];
    const confirmed = state.puede.length + state.sub.length;
    const remaining = Math.max(0, MAX_WAR_PLAYERS - confirmed);

    if (remaining === 0) {
      text += `🕒 **${hour}:00** → ✅ COMPLETA\n`;
    } else {
      text += `🕒 **${hour}:00** → ⏳ ${remaining} plazas libres\n`;
    }
  }

  const payload = {
    content: text,
    allowedMentions: {
      roles: WAR_ROLE_IDS
    }
  };

  if (!globalMessage) {
    globalMessage = await channel.send(payload);
  } else {
    await globalMessage.edit(payload);
  }
}
