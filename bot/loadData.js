
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class DataLoader {
  constructor() {
    this.commandsPath = path.join(__dirname, '../scripts/cmds');
    this.eventsPath = path.join(__dirname, '../scripts/events');
  }

  async autoInstallPackage(packageName) {
    try {
      global.logger.info(`📦 Auto-installing missing package: ${packageName}`);
      execSync(`npm install ${packageName}`, { stdio: 'inherit' });
      global.logger.success(`✅ Successfully installed ${packageName}`);
      return true;
    } catch (error) {
      global.logger.error(`Failed to install ${packageName}`, error);
      return false;
    }
  }

  async loadCommands() {
    const loadedCommands = [];
    const failedCommands = [];

    try {
      await fs.mkdir(this.commandsPath, { recursive: true });
      const files = await fs.readdir(this.commandsPath);
      const jsFiles = files.filter(f => f.endsWith('.js'));

      for (const file of jsFiles) {
        const result = await this.loadCommand(file);
        if (result.success) {
          loadedCommands.push(result.name);
        } else if (result.error && result.error.includes('Cannot find module')) {
          const match = result.error.match(/Cannot find module '([^']+)'/);
          if (match && match[1]) {
            const packageName = match[1];
            const installed = await this.autoInstallPackage(packageName);
            if (installed) {
              const retryResult = await this.loadCommand(file);
              if (retryResult.success) {
                loadedCommands.push(retryResult.name);
              } else {
                failedCommands.push({ file, error: retryResult.error });
              }
            } else {
              failedCommands.push({ file, error: result.error });
            }
          } else {
            failedCommands.push({ file, error: result.error });
          }
        } else {
          failedCommands.push({ file, error: result.error });
        }
      }

      return { loaded: loadedCommands, failed: failedCommands };
    } catch (error) {
      global.logger.error('Error loading commands directory', error);
      return { loaded: [], failed: [] };
    }
  }

  async loadCommand(filename) {
    const filePath = path.join(this.commandsPath, filename);

    try {
      if (global.config.skipCmds && global.config.skipCmds.includes(filename)) {
        return { success: false, error: 'Skipped in config' };
      }

      delete require.cache[require.resolve(filePath)];
      const command = require(filePath);

      if (!command.config || !command.config.name) {
        return { success: false, error: 'Missing config.name' };
      }

      if (!command.ST && !command.onChat && !command.onReply && !command.onReaction) {
        return { success: false, error: 'No handler functions found' };
      }

      // Check for duplicate command name
      if (global.ST.commands.has(command.config.name)) {
        return { success: false, error: `Duplicate command name: ${command.config.name}` };
      }

      // Check for duplicate aliases
      if (command.config.aliases && Array.isArray(command.config.aliases)) {
        for (const [existingName, existingCmd] of global.ST.commands) {
          // Check if new command's name conflicts with existing aliases
          if (existingCmd.config.aliases && existingCmd.config.aliases.includes(command.config.name)) {
            return { success: false, error: `Command name conflicts with alias of ${existingName}` };
          }

          // Check if new command's aliases conflict with existing command names
          for (const alias of command.config.aliases) {
            if (existingName === alias) {
              return { success: false, error: `Alias "${alias}" conflicts with command ${existingName}` };
            }

            // Check if new aliases conflict with existing aliases
            if (existingCmd.config.aliases && existingCmd.config.aliases.includes(alias)) {
              return { success: false, error: `Alias "${alias}" conflicts with ${existingName}` };
            }
          }
        }
      }

      global.ST.commands.set(command.config.name, command);

      if (command.onChat) {
        global.ST.onChat.add(command.config.name);
      }

      return { success: true, name: command.config.name };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async unloadCommand(commandName) {
    try {
      if (!global.ST.commands.has(commandName)) {
        return { success: false, error: 'Command not found' };
      }

      const command = global.ST.commands.get(commandName);
      global.ST.commands.delete(commandName);

      if (command.onChat) {
        global.ST.onChat.delete(commandName);
      }

      const files = await fs.readdir(this.commandsPath);
      const cmdFile = files.find(f => {
        try {
          const cmd = require(path.join(this.commandsPath, f));
          return cmd.config && cmd.config.name === commandName;
        } catch {
          return false;
        }
      });

      if (cmdFile) {
        const filePath = path.join(this.commandsPath, cmdFile);
        delete require.cache[require.resolve(filePath)];
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async loadEvents() {
    const loadedEvents = [];
    const failedEvents = [];

    try {
      await fs.mkdir(this.eventsPath, { recursive: true });
      const files = await fs.readdir(this.eventsPath);
      const jsFiles = files.filter(f => f.endsWith('.js'));

      for (const file of jsFiles) {
        const result = await this.loadEvent(file);
        if (result.success) {
          loadedEvents.push(result.name);
        } else if (result.error && result.error.includes('Cannot find module')) {
          const match = result.error.match(/Cannot find module '([^']+)'/);
          if (match && match[1]) {
            const packageName = match[1];
            const installed = await this.autoInstallPackage(packageName);
            if (installed) {
              const retryResult = await this.loadEvent(file);
              if (retryResult.success) {
                loadedEvents.push(retryResult.name);
              } else {
                failedEvents.push({ file, error: retryResult.error });
              }
            } else {
              failedEvents.push({ file, error: result.error });
            }
          } else {
            failedEvents.push({ file, error: result.error });
          }
        } else {
          failedEvents.push({ file, error: result.error });
        }
      }

      return { loaded: loadedEvents, failed: failedEvents };
    } catch (error) {
      global.logger.error('Error loading events directory', error);
      return { loaded: [], failed: [] };
    }
  }

  async loadEvent(filename) {
    const filePath = path.join(this.eventsPath, filename);

    try {
      if (global.config.skipEvents && global.config.skipEvents.includes(filename)) {
        return { success: false, error: 'Skipped in config' };
      }

      delete require.cache[require.resolve(filePath)];
      const event = require(filePath);

      if (!event.config || !event.config.name) {
        return { success: false, error: 'Missing config.name' };
      }

      // Check for duplicate event name
      if (global.ST.events.has(event.config.name)) {
        return { success: false, error: `Duplicate event name: ${event.config.name}` };
      }

      global.ST.events.set(event.config.name, event);

      return { success: true, name: event.config.name };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async unloadEvent(eventName) {
    try {
      if (!global.ST.events.has(eventName)) {
        return { success: false, error: 'Event not found' };
      }

      global.ST.events.delete(eventName);

      const files = await fs.readdir(this.eventsPath);
      const eventFile = files.find(f => {
        try {
          const evt = require(path.join(this.eventsPath, f));
          return evt.config && evt.config.name === eventName;
        } catch {
          return false;
        }
      });

      if (eventFile) {
        const filePath = path.join(this.eventsPath, eventFile);
        delete require.cache[require.resolve(filePath)];
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async installCommand(filename, code) {
    try {
      const filePath = path.join(this.commandsPath, filename);
      await fs.writeFile(filePath, code, 'utf8');

      const result = await this.loadCommand(filename);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async installEvent(filename, code) {
    try {
      const filePath = path.join(this.eventsPath, filename);
      await fs.writeFile(filePath, code, 'utf8');

      const result = await this.loadEvent(filename);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteCommand(filename) {
    try {
      const filePath = path.join(this.commandsPath, filename);
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteEvent(filename) {
    try {
      const filePath = path.join(this.eventsPath, filename);
      await fs.unlink(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new DataLoader();
