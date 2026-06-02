const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class Message {
  constructor(client, event) {
    this.client = client;
    this.event = event;
  }

  createButton(customId, label, style = 'Primary', emoji = null) {
    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(label)
      .setStyle(ButtonStyle[style]);

    if (emoji) {
      button.setEmoji(emoji);
    }

    return button;
  }

  createButtonRow(buttons) {
    const row = new ActionRowBuilder();
    buttons.forEach(btn => row.addComponents(btn));
    return row;
  }

  async reply(content) {
    try {
      const options = this.formatMessage(content);
      const sentMsg = await this.event.reply(options);
      return { messageID: sentMsg.id, threadID: sentMsg.channel.id };
    } catch (error) {
      global.logger.error('Error in message.reply', error);
      return null;
    }
  }

  async send(content) {
    try {
      const options = this.formatMessage(content);
      const sentMsg = await this.event.channel.send(options);
      return { messageID: sentMsg.id, threadID: sentMsg.channel.id };
    } catch (error) {
      global.logger.error('Error in message.send', error);
      return null;
    }
  }

  async sendWithButtons(content, buttons, callback) {
    try {
      const options = this.formatMessage(content);
      const rows = [];

      for (let i = 0; i < buttons.length; i += 5) {
        const row = this.createButtonRow(buttons.slice(i, i + 5));
        rows.push(row);
      }

      options.components = rows;
      const sentMsg = await this.event.channel.send(options);

      if (callback) {
        global.Callback.set(sentMsg.id, {
          callback,
          authorId: this.event.author.id,
          timestamp: Date.now()
        });
      }

      return { messageID: sentMsg.id, threadID: sentMsg.channel.id };
    } catch (error) {
      global.logger.error('Error in sendWithButtons', error);
      return null;
    }
  }

  async replyWithButtons(content, buttons, callback) {
    try {
      const options = this.formatMessage(content);
      const rows = [];

      for (let i = 0; i < buttons.length; i += 5) {
        const row = this.createButtonRow(buttons.slice(i, i + 5));
        rows.push(row);
      }

      options.components = rows;
      const sentMsg = await this.event.reply(options);

      if (callback) {
        global.Callback.set(sentMsg.id, {
          callback,
          authorId: this.event.author.id,
          timestamp: Date.now()
        });
      }

      return { messageID: sentMsg.id, threadID: sentMsg.channel.id };
    } catch (error) {
      global.logger.error('Error in replyWithButtons', error);
      return null;
    }
  }

  async unsend(messageID) {
    try {
      if (!messageID) return false;

      const msgId = typeof messageID === 'object' ? messageID.messageID : messageID;
      const message = await this.event.channel.messages.fetch(msgId);
      await message.delete();
      return true;
    } catch (error) {
      global.logger.error('Error in message.unsend', error);
      return false;
    }
  }

  async react(emoji, messageID = null) {
    try {
      let targetMsg;

      if (messageID) {
        const msgId = typeof messageID === 'object' ? messageID.messageID : messageID;
        targetMsg = await this.event.channel.messages.fetch(msgId);
      } else {
        targetMsg = this.event;
      }

      await targetMsg.react(emoji);
      return true;
    } catch (error) {
      global.logger.error('Error in message.react', error);
      return false;
    }
  }

  async reaction(emoji, messageID = null) {
    return this.react(emoji, messageID);
  }

  async pr(text, successEmoji = '✅') {
    const sentMsg = await this.reply(text);

    return {
      messageID: sentMsg?.messageID,
      success: async (newText) => {
        if (sentMsg?.messageID) {
          await this.react(successEmoji, sentMsg.messageID);
          if (newText) {
            await this.edit(sentMsg.messageID, newText);
          }
        }
      },
      error: async (errorText) => {
        if (sentMsg?.messageID) {
          await this.react('❌', sentMsg.messageID);
          if (errorText) {
            await this.edit(sentMsg.messageID, errorText);
          }
        }
      },
      update: async (updateText) => {
        if (sentMsg?.messageID && updateText) {
          await this.edit(sentMsg.messageID, updateText);
        }
      }
    };
  }

  hasAttachments() {
    if (!this.event.reference) return false;

    try {
      const replied = this.event.reference;
      return replied && this.event.attachments && this.event.attachments.size > 0;
    } catch {
      return false;
    }
  }

  getAttachments() {
    try {
      if (this.event.attachments && this.event.attachments.size > 0) {
        return Array.from(this.event.attachments.values());
      }
      return [];
    } catch {
      return [];
    }
  }

  async downloadMedia(attachmentIndex = 0) {
    try {
      const attachments = this.getAttachments();
      if (!attachments || attachments.length === 0) return null;

      const attachment = attachments[attachmentIndex];
      if (!attachment || !attachment.url) return null;

      const axios = require('axios');
      const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (error) {
      global.logger.error('Error downloading media', error);
      return null;
    }
  }

  async sendImage(imageBuffer, caption = '') {
    try {
      const fs = require('fs');
      const path = require('path');

      let imagePath;
      if (Buffer.isBuffer(imageBuffer)) {
        imagePath = path.join(__dirname, `temp_${Date.now()}.jpg`);
        fs.writeFileSync(imagePath, imageBuffer);
      } else if (typeof imageBuffer === 'string') {
        imagePath = imageBuffer;
      } else {
        imagePath = path.join(__dirname, `temp_${Date.now()}.jpg`);
        fs.writeFileSync(imagePath, imageBuffer);
      }

      const sentMsg = await this.reply({
        body: caption,
        attachment: fs.createReadStream(imagePath)
      });

      setTimeout(() => {
        try {
          if (fs.existsSync(imagePath) && imagePath.includes('temp_')) {
            fs.unlinkSync(imagePath);
          }
        } catch (e) {}
      }, 10000);

      return sentMsg;
    } catch (error) {
      global.logger.error('Error sending image', error);
      return null;
    }
  }

  async edit(messageID, newContent) {
    try {
      const msgId = typeof messageID === 'object' ? messageID.messageID : messageID;
      const message = await this.event.channel.messages.fetch(msgId);
      const options = this.formatMessage(newContent);
      await message.edit(options);
      return true;
    } catch (error) {
      global.logger.error('Error in message.edit', error);
      return false;
    }
  }

  async typingIndicator(duration = 5000) {
    try {
      await this.event.channel.sendTyping();
      if (duration > 0) {
        setTimeout(() => {}, duration);
      }
      return true;
    } catch (error) {
      global.logger.error('Error in typingIndicator', error);
      return false;
    }
  }

  formatMessage(content) {
    if (typeof content === 'string') {
      return { content };
    }

    const options = {};

    if (content.body) {
      options.content = content.body;
    }

    if (content.attachment) {
      const attachments = Array.isArray(content.attachment) 
        ? content.attachment 
        : [content.attachment];

      options.files = attachments.map((att, index) => {
        if (typeof att === 'string') {
          return att;
        }
        if (att.readable || att.path) {
          // Detect file extension from stream path
          const path = require('path');
          let extension = '.png';

          if (att.path) {
            extension = path.extname(att.path);
          }

          // Determine proper filename based on extension
          let filename = `attachment_${index}${extension}`;

          // Map common extensions to proper filenames
          const extMap = {
            '.mp3': `audio_${index}.mp3`,
            '.mp4': `video_${index}.mp4`,
            '.wav': `audio_${index}.wav`,
            '.m4a': `audio_${index}.m4a`,
            '.jpg': `image_${index}.jpg`,
            '.jpeg': `image_${index}.jpeg`,
            '.png': `image_${index}.png`,
            '.gif': `image_${index}.gif`,
            '.webm': `video_${index}.webm`,
            '.avi': `video_${index}.avi`,
            '.mov': `video_${index}.mov`
          };

          if (extMap[extension]) {
            filename = extMap[extension];
          }

          return new AttachmentBuilder(att, { name: filename });
        }
        return att;
      });
    }

    if (content.mentions) {
      options.allowedMentions = { parse: content.mentions };
    }

    return options;
  }
}

module.exports = Message;
