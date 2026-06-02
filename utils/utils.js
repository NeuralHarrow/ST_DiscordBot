const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');

const streamPipeline = promisify(pipeline);

class Utils {
  async getStreamFromURL(url, pathName = null) {
    try {
      const response = await axios.get(url, { responseType: 'stream' });

      if (pathName) {
        const tempPath = path.join(__dirname, '../temp', pathName);
        await fs.promises.mkdir(path.dirname(tempPath), { recursive: true });
        await streamPipeline(response.data, createWriteStream(tempPath));
        return fs.createReadStream(tempPath);
      }

      return response.data;
    } catch (error) {
      global.logger.error('Error fetching stream from URL', error);
      return null;
    }
  }

  async downloadFile(url, savePath) {
    try {
      const response = await axios.get(url, { responseType: 'stream' });
      await fs.promises.mkdir(path.dirname(savePath), { recursive: true });
      await streamPipeline(response.data, createWriteStream(savePath));
      return savePath;
    } catch (error) {
      global.logger.error('Error downloading file', error);
      return null;
    }
  }

  getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
  }

  getMimeType(filename) {
    const ext = this.getFileExtension(filename);
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.json': 'application/json'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  isImage(filename) {
    const ext = this.getFileExtension(filename);
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext);
  }

  isVideo(filename) {
    const ext = this.getFileExtension(filename);
    return ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
  }

  isAudio(filename) {
    const ext = this.getFileExtension(filename);
    return ['.mp3', '.wav', '.ogg', '.m4a'].includes(ext);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getTime(timezone = 'UTC') {
    return new Date().toLocaleString('en-US', { timeZone: timezone });
  }

  getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }
}


const utilsInstance = new Utils();


module.exports = {
  Utils: utilsInstance
};
