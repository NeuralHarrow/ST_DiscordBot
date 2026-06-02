const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const logger = require('./logger/logs');
const utils = require('./utils/utils');
const JSONProvider = require('./database/JSONProvider');
const MongoProvider = require('./database/MongoProvider');
const UsersData = require('./database/userdb');
const ThreadsData = require('./database/groupdb');

class GlobalContext {
  constructor() {
    this.config = null;
    this.client = null;
    this.ST = {
      commands: new Collection(),
      events: new Collection(),
      onReply: new Map(),
      onReaction: new Map(),
      onChat: new Set(),
      callbacks: new Map()
    };
    this.db = null;
    this.usersData = null;
    this.threadsData = null;
    this.utils = utils;
    this.logger = logger;
    this.startTime = Date.now();
    this.Callback = new Map();
  }

  async initialize() {
    this.loadConfig();
    await this.initializeDatabase();
    this.createClient();
    this.freezeGlobals();
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, 'config.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      this.config = JSON.parse(configData);

      if (process.env.BOT_TOKEN) {
        this.config.botToken = process.env.BOT_TOKEN;
      }
      if (process.env.BOT_CLIENT_ID) {
        this.config.botClientId = process.env.BOT_CLIENT_ID;
      }

      logger.success('Configuration loaded');
    } catch (error) {
      logger.error('Failed to load config.json', error);
      process.exit(1);
    }
  }

  async initializeDatabase() {
    try {
      global.logger = logger;

      if (this.config.databaseType === 'mongo') {
        this.db = new MongoProvider();
      } else {
        this.db = new JSONProvider();
      }

      await this.db.init();

      this.usersData = new UsersData(this.db);
      this.threadsData = new ThreadsData(this.db);

      logger.success('Database initialized');
    } catch (error) {
      logger.error('Failed to initialize database', error);
      process.exit(1);
    }
  }

  createClient() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction
      ]
    });

    logger.success('Discord client created');
  }

  freezeGlobals() {
    global.config = this.config;
    global.client = this.client;
    global.ST = this.ST;
    global.db = this.db;
    global.usersData = this.usersData;
    global.threadsData = this.threadsData;
    global.utils = {
      ...this.utils.Utils,
      STBotApis: this.utils.STBotApis,
      getStreamFromURL: this.utils.Utils.getStreamFromURL.bind(this.utils.Utils),
      downloadFile: this.utils.Utils.downloadFile.bind(this.utils.Utils),
      getFileExtension: this.utils.Utils.getFileExtension.bind(this.utils.Utils),
      getMimeType: this.utils.Utils.getMimeType.bind(this.utils.Utils),
      isImage: this.utils.Utils.isImage.bind(this.utils.Utils),
      isVideo: this.utils.Utils.isVideo.bind(this.utils.Utils),
      isAudio: this.utils.Utils.isAudio.bind(this.utils.Utils),
      formatBytes: this.utils.Utils.formatBytes.bind(this.utils.Utils),
      randomInt: this.utils.Utils.randomInt.bind(this.utils.Utils),
      sleep: this.utils.Utils.sleep.bind(this.utils.Utils),
      getTime: this.utils.Utils.getTime.bind(this.utils.Utils),
      getRandomElement: this.utils.Utils.getRandomElement.bind(this.utils.Utils)
    };
    global.logger = this.logger;
    global.Callback = this.Callback;

    Object.assign(global.ST, {
      STBotApis: this.utils.stBotApisInstance
    });

    logger.success('Global context initialized and frozen');
  }

  getUptime() {
    const uptime = Date.now() - this.startTime;
    const seconds = Math.floor(uptime / 1000) % 60;
    const minutes = Math.floor(uptime / (1000 * 60)) % 60;
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  }
}

const globalContext = new GlobalContext();

async function start() {
  try {
    await globalContext.initialize();

    const login = require('./bot/login/login');
    await login(globalContext.client);
  } catch (error) {
    logger.error('Fatal error during startup', error);
    process.exit(1);
  }
}

start();

module.exports = globalContext;
