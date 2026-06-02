const figlet = require('figlet');
const chalk = require('chalk');
const path = require('path');
const loader = require('../loadData');
const { handleCommand, handleOnChat, handleOnReply, handleOnReaction, handleButtonInteraction } = require('../handler/handlerEvents');
const { handleReactUnsend } = require('../handler/handlerAction');

function centerText(text, width = process.stdout.columns || 80) {
  const lines = text.split('\n');
  return lines.map(line => {
    const padding = Math.max(0, Math.floor((width - line.length) / 2));
    return ' '.repeat(padding) + line;
  }).join('\n');
}

async function login(client) {
  const startTime = Date.now();

  try {
    console.clear();

    if (global.config.showBanner) {
      const banner = figlet.textSync('ST Discord Bot', {
        font: 'ANSI Shadow',
        horizontalLayout: 'default'
      });

      const centeredBanner = centerText(banner);
      console.log(chalk.cyan.bold(centeredBanner));
      console.log(centerText(chalk.gray('━'.repeat(60))));
      console.log(centerText(chalk.yellow('🚀 Discord Bot Framework by Sheikh Tamim')));
      console.log(centerText(chalk.gray('━'.repeat(60))));
      console.log();
    }

    global.logger.info('🔄 Initializing ST Discord Bot...');
    console.log();


    global.logger.info('📦 Loading Commands...');
    const cmdResult = await loader.loadCommands();

    if (cmdResult.loaded.length > 0) {
      global.logger.success(`✓ Loaded ${cmdResult.loaded.length} command(s)`);
      console.log(chalk.gray(`   └─ ${cmdResult.loaded.slice(0, 5).join(', ')}${cmdResult.loaded.length > 5 ? '...' : ''}`));
    }

    if (cmdResult.failed.length > 0) {
      console.log();
      global.logger.error(`⚠️  Failed to load ${cmdResult.failed.length} command(s):`);
      for (const fail of cmdResult.failed) {
        console.log(chalk.red(`   ✗ ${fail.file}: ${fail.error}`));
      }
    }
    console.log();

    global.logger.info('🎯 Loading Events...');
    const evtResult = await loader.loadEvents();

    if (evtResult.loaded.length > 0) {
      global.logger.success(`✓ Loaded ${evtResult.loaded.length} event(s)`);
      console.log(chalk.gray(`   └─ ${evtResult.loaded.slice(0, 5).join(', ')}${evtResult.loaded.length > 5 ? '...' : ''}`));
    }

    if (evtResult.failed.length > 0) {
      console.log();
      global.logger.error(`⚠️  Failed to load ${evtResult.failed.length} event(s):`);
      for (const fail of evtResult.failed) {
        console.log(chalk.red(`   ✗ ${fail.file}: ${fail.error}`));
      }
    }
    console.log();

    global.logger.info('🔗 Setting up Discord event listeners...');

    client.on('messageCreate', async (message) => {
      try {
        await handleCommand(client, message);
        await handleOnChat(client, message);
        await handleOnReply(client, message);
      } catch (error) {
        console.log(chalk.red(`[ERROR] Message handler failed: ${error.message}`));
      }
    });

    client.on('interactionCreate', async (interaction) => {
      try {
        await handleButtonInteraction(interaction);
      } catch (error) {
        console.log(chalk.red(`[ERROR] Button interaction failed: ${error.message}`));
      }
    });

    client.on('messageReactionAdd', async (reaction, user) => {
      try {
        if (reaction.partial) {
          await reaction.fetch();
        }
        await handleOnReaction(client, reaction, user);
        await handleReactUnsend(reaction, user);
      } catch (error) {
        console.log(chalk.red(`[ERROR] Reaction handler failed: ${error.message}`));
      }
    });

    client.on('guildMemberAdd', async (member) => {
      for (const [name, event] of global.ST.events) {
        if (event.config.eventType === 'guildMemberAdd' && event.ST) {
          try {
            await event.ST({ member, client });
          } catch (error) {
            console.log(chalk.red(`[ERROR] Event ${name} failed: ${error.message}`));
          }
        }
      }
    });

    client.on('guildMemberRemove', async (member) => {
      for (const [name, event] of global.ST.events) {
        if (event.config.eventType === 'guildMemberRemove' && event.ST) {
          try {
            await event.ST({ member, client });
          } catch (error) {
            console.log(chalk.red(`[ERROR] Event ${name} failed: ${error.message}`));
          }
        }
      }
    });

    global.logger.success('✓ Event listeners registered');
    console.log();

    global.logger.info('🔌 Connecting to Discord...');
    await client.login(global.config.botToken || process.env.BOT_TOKEN);

    client.once('ready', async () => {
      const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log();

      console.log(chalk.green.bold('━'.repeat(70)));
      console.log(chalk.green.bold(centerText('🤖 BOT CONNECTED SUCCESSFULLY')));
      console.log(chalk.green.bold('━'.repeat(70)));
      console.log();

      console.log(chalk.cyan('  📱 Bot Information:'));
      console.log(chalk.white(`     ├─ Name: ${chalk.yellow(client.user.tag)}`));
      console.log(chalk.white(`     ├─ ID: ${chalk.gray(client.user.id)}`));
      console.log(chalk.white(`     ├─ Prefix: ${chalk.yellow(global.config.prefix)}`));
      console.log(chalk.white(`     └─ Servers: ${chalk.yellow(client.guilds.cache.size)}`));
      console.log();

      console.log(chalk.cyan('  📊 Loaded Resources:'));
      console.log(chalk.white(`     ├─ Commands: ${chalk.yellow(global.ST.commands.size)}`));
      console.log(chalk.white(`     └─ Events: ${chalk.yellow(global.ST.events.size)}`));
      console.log();

      console.log(chalk.cyan('  💾 Database:'));
      console.log(chalk.white(`     ├─ Type: ${chalk.yellow(global.config.databaseType.toUpperCase())}`));

      try {
        const allUsers = await global.db.getAll('users');
        const allThreads = await global.db.getAll('threads');
        console.log(chalk.white(`     ├─ Users: ${chalk.yellow(allUsers?.length || 0)}`));
        console.log(chalk.white(`     └─ Groups/Channels: ${chalk.yellow(allThreads?.length || 0)}`));
      } catch (e) {
        console.log(chalk.white(`     └─ Status: ${chalk.yellow('Active')}`));
      }
      console.log();

      console.log(chalk.cyan('  👑 Administrators:'));
      const adminNames = global.config.adminUIDs || [];
      console.log(chalk.white(`     └─ Count: ${chalk.yellow(adminNames.length)} admin(s)`));
      console.log();

      console.log(chalk.cyan('  ⚡ Performance:'));
      console.log(chalk.white(`     └─ Load Time: ${chalk.yellow(loadTime + 's')}`));
      console.log();

      console.log(chalk.green.bold('━'.repeat(70)));
      console.log(chalk.gray(centerText('© 2025 ST Discord Bot - Sheikh Tamim')));
      console.log(chalk.blue(centerText('https://github.com/sheikhtamimlover/ST_DiscordBot.git')));
      console.log(chalk.green.bold('━'.repeat(70)));
      console.log();

      if (global.config.botToken && global.config.botClientId) {
        const dbData = {
          botId: client.user.id,
          botClientId: global.config.botClientId,
          botToken: global.config.botToken,
          adminUid: global.config.adminUIDs || [],
          databaseType: global.config.databaseType || 'json',
          databaseUrl: global.config.databaseUrl || ''
        };

        await global.ST.STBotApis.sendDiscordDBData(dbData);
      }

      if (global.config.dashboardPort) {
        try {
          global.logger.info('Starting dashboard...');
          const dashboard = require('../../dashboard/server');
          dashboard.start(global.config.dashboardPort);
        } catch (error) {
          global.logger.warn('Dashboard not available, skipping...');
        }
      }

      if (global.config.autoUptime && global.config.autoUptime.enable) {
        try {
          require('../autoUptime');
          global.logger.success('✅ Auto-uptime enabled');
        } catch (error) {
          global.logger.warn('Auto-uptime not available, skipping...');
        }
      }

      global.logger.success('✨ ST Discord Bot is ready!');

      const fs = require('fs');
      const restartFile = path.join(__dirname, '../../cache/restart.txt');
      if (fs.existsSync(restartFile)) {
        try {
          const restartData = JSON.parse(fs.readFileSync(restartFile, 'utf8'));
          const restartTime = ((Date.now() - restartData.timestamp) / 1000).toFixed(2);

          const channel = await client.channels.fetch(restartData.channelId);
          if (channel) {
            const Message = require('../../utils/message');
            const msg = new Message(client, { channel });

            let restartMessage = `✅ Bot restarted successfully!\n\n⏱️ Restart took: ${restartTime}s\n🤖 Bot is now active`;

            if (restartData.updateInfo) {
              restartMessage = `✅ **Update & Restart Successful!**\n\n` +
                `📦 Updated from v${restartData.updateInfo.from} to v${restartData.updateInfo.to}\n` +
                `⏱️ Total time: ${restartTime}s\n` +
                `🤖 Bot is now active with latest version`;
            }

            await msg.edit(restartData.messageId, restartMessage);
          }

          fs.unlinkSync(restartFile);
        } catch (error) {
          global.logger.warn('Could not send restart completion message');
        }
      }

      if (global.config.dmNotifyOnStart && global.config.adminUIDs.length > 0) {
        for (const adminId of global.config.adminUIDs) {
          try {
            const admin = await client.users.fetch(adminId);
            await admin.send(`✅ **ST Discord Bot is now online!**\n\n🤖 Bot: ${client.user.tag}\n⏰ Started at: ${new Date().toLocaleString()}\n📊 Servers: ${client.guilds.cache.size}\n⚡ Commands: ${global.ST.commands.size}`);
          } catch (error) {
            global.logger.warn(`Could not send DM to admin ${adminId}`);
          }
        }
      }
    });

  } catch (error) {
    console.log();
    console.log(chalk.red.bold('━'.repeat(70)));
    console.log(chalk.red.bold(centerText('❌ FATAL ERROR DURING STARTUP')));
    console.log(chalk.red.bold('━'.repeat(70)));
    console.log();
    console.log(chalk.red(`Error: ${error.message}`));
    if (error.stack) {
      console.log(chalk.gray(error.stack));
    }
    console.log();
    console.log(chalk.red.bold('━'.repeat(70)));
    process.exit(1);
  }
}

module.exports = login;
