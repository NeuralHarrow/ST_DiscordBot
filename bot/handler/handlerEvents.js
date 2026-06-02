const Message = require('../../utils/message');

async function handleCommand(client, event) {
  const { content, author, channel, guild } = event;

  if (!content || author.bot) return;

  const threadID = channel.id;
  const threadData = await global.threadsData.get(threadID);
  const prefix = threadData?.prefix || global.config?.prefix || '!';

  if (content === prefix.trim()) {
    return event.reply(`📌 Current prefix: \`${prefix}\`\nUse \`${prefix}help\` to see all commands.`);
  }

  if (!content.startsWith(prefix)) {
    return;
  }

  const args = content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  let command = global.ST.commands.get(commandName);

  // Check aliases if command not found
  if (!command) {
    for (const [name, cmd] of global.ST.commands) {
      if (cmd.config.aliases && cmd.config.aliases.includes(commandName)) {
        command = cmd;
        break;
      }
    }
  }

  if (!command || !command.ST) {
    const suggestions = Array.from(global.ST.commands.keys()).filter(cmd => 
      cmd.includes(commandName)
    ).slice(0, 5);

    if (suggestions.length > 0) {
      await event.reply(`❌ Command \`${commandName}\` does not exist.\n\nDid you mean: ${suggestions.map(s => `\`${prefix}${s}\``).join(', ')}?`);
    } else {
      await event.reply(`❌ Command \`${commandName}\` does not exist. Use \`${prefix}help\` to see all commands.`);
    }
    return;
  }

  if (global.config.adminOnly && !global.config.adminUIDs.includes(author.id)) {
    return event.reply('❌ Bot is in admin-only mode.');
  }

  try {
    const senderID = author.id;
    const threadID = channel.id;
    const messageID = event.id;

    const isBanned = await global.usersData.isBanned(senderID);
    if (isBanned) {
      return event.reply('❌ You are banned from using this bot.');
    }

    const user = await global.usersData.get(senderID);
    if (!user.name || user.name === 'Unknown User') {
      await global.usersData.set(senderID, {
        name: author.username,
        username: author.tag,
        avatar: author.displayAvatarURL()
      });
    }

    const isAdmin = global.config.adminUIDs.includes(senderID);
    const requiredRole = command.config.role || 0;

    if (requiredRole === 2 && !isAdmin) {
      return event.reply('❌ This command requires admin privileges.');
    }

    global.logger.command(author.username, senderID, commandName, threadID);
    global.logger.processing(commandName);

    const message = new Message(client, event);

    const context = {
      api: client,
      event: {
        senderID,
        threadID,
        messageID,
        body: content,
        args,
        author,
        channel,
        guild
      },
      args,
      message,
      usersData: global.usersData,
      threadsData: global.threadsData,
      client,
      command
    };

    await command.ST(context);
    global.logger.success(`Command ${commandName} executed successfully`);

  } catch (error) {
    global.logger.error(`Error executing command ${commandName}`, error);
    try {
      await event.reply('❌ An error occurred while executing this command.');
    } catch (e) {
      global.logger.error('Failed to send error message', e);
    }
  }
}

async function handleOnChat(client, event) {
  const { content, author } = event;

  if (!content || author.bot) return;

  for (const commandName of global.ST.onChat) {
    const command = global.ST.commands.get(commandName);
    if (!command || !command.onChat) continue;

    try {
      const senderID = author.id;
      const message = new Message(client, event);
      const threadData = await global.threadsData.get(event.channel.id);

      const context = {
        api: client,
        event: {
          senderID,
          threadID: event.channel.id,
          messageID: event.id,
          body: content,
          author,
          channel: event.channel,
          guild: event.guild
        },
        message,
        usersData: global.usersData,
        threadsData: global.threadsData,
        client,
        config: {
          prefix: threadData?.prefix || global.config?.prefix || '!'
        }
      };

      await command.onChat(context);
    } catch (error) {
      global.logger.error(`Error in onChat for ${commandName}`, error);
    }
  }
}

async function handleOnReply(client, event) {
  const { reference, author } = event;

  if (!reference || author.bot) return;

  const replyData = global.ST.onReply.get(reference.messageId);
  if (!replyData) return;

  const command = global.ST.commands.get(replyData.commandName);
  if (!command || !command.onReply) return;

  try {
    const senderID = author.id;
    const message = new Message(client, event);

    const context = {
      api: client,
      event: {
        senderID,
        threadID: event.channel.id,
        messageID: event.id,
        body: event.content,
        author,
        channel: event.channel,
        guild: event.guild
      },
      message,
      Reply: replyData,
      usersData: global.usersData,
      threadsData: global.threadsData,
      client
    };

    await command.onReply(context);
  } catch (error) {
    global.logger.error(`Error in onReply for ${replyData.commandName}`, error);
  }
}

async function handleOnReaction(client, reaction, user) {
  if (user.bot) return;

  const messageId = reaction.message.id;
  const reactionData = global.ST.onReaction.get(messageId);

  if (!reactionData) return;

  const command = global.ST.commands.get(reactionData.commandName);
  if (!command || !command.onReaction) return;

  try {
    const message = new Message(client, reaction.message);

    const context = {
      api: client,
      event: {
        reaction: reaction.emoji.name,
        userID: user.id,
        messageID: messageId,
        threadID: reaction.message.channel.id
      },
      message,
      Reaction: reactionData,
      usersData: global.usersData,
      threadsData: global.threadsData,
      client
    };

    await command.onReaction(context);
  } catch (error) {
    global.logger.error(`Error in onReaction for ${reactionData.commandName}`, error);
  }
}

async function handleButtonInteraction(interaction) {
  if (!interaction.isButton()) return;

  const callbackData = global.Callback.get(interaction.message.id);
  if (!callbackData) {
    return interaction.reply({ content: '❌ This interaction has expired or is no longer available.', ephemeral: true }).catch(() => {});
  }

  if (callbackData.authorId && callbackData.authorId !== interaction.user.id) {
    return interaction.reply({ content: '❌ This button is not for you!', ephemeral: true }).catch(() => {});
  }

  try {
    if (typeof callbackData.callback === 'function') {
      await callbackData.callback(interaction);
    } else if (callbackData.commandName) {
      const command = global.ST.commands.get(callbackData.commandName);
      if (command && command.onCallback) {
        const Message = require('../../utils/message');
        const message = new Message(interaction.client, interaction.message);

        await command.onCallback({
          interaction,
          message,
          event: {
            senderID: interaction.user.id,
            threadID: interaction.channel.id,
            messageID: interaction.message.id,
            customId: interaction.customId,
            user: interaction.user,
            channel: interaction.channel
          },
          callbackData,
          client: interaction.client
        });
      }
    }
  } catch (error) {
    global.logger.error('Error in button callback', error);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '❌ An error occurred while processing this action.', ephemeral: true });
      } else {
        await interaction.followUp({ content: '❌ An error occurred.', ephemeral: true });
      }
    } catch (e) {
      global.logger.error('Failed to send error message', e);
    }
  }
}

module.exports = {
  handleCommand,
  handleOnChat,
  handleOnReply,
  handleOnReaction,
  handleButtonInteraction
};
