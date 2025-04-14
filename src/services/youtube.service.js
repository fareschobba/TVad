const ytdl = require('ytdl-core');
const path = require('path');
const fs = require('fs');
const b2Service = require('./b2.service');

const options = {
  requestOptions: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  }
};

class YouTubeService {
  constructor() {
    this.tempDir = path.join(__dirname, '../uploads/youtube');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async cleanupTempFiles() {
    try {
      const files = await fs.promises.readdir(this.tempDir);
      const now = Date.now();
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000); // 24 hours in milliseconds

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        try {
          const stats = await fs.promises.stat(filePath);
          // Delete files older than 24 hours
          if (stats.ctimeMs < twentyFourHoursAgo) {
            await fs.promises.unlink(filePath);
            console.log(`Cleaned up old temp file: ${filePath}`);
          }
        } catch (err) {
          console.error(`Error checking file ${filePath}:`, err);
        }
      }
    } catch (err) {
      console.error('Error cleaning up temp directory:', err);
    }
  }

  async validateYouTubeUrl(url) {
    try {
      return ytdl.validateURL(url);
    } catch (error) {
      return false;
    }
  }

  async getVideoInfo(url) {
    try {
      if (!ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL');
      }

      const info = await ytdl.getInfo(url, options);
      const formats = ytdl.filterFormats(info.formats, 'videoandaudio');

      return {
        title: info.videoDetails.title,
        duration: parseInt(info.videoDetails.lengthSeconds),
        thumbnail: info.videoDetails.thumbnails[0].url,
        formats: formats.map(format => ({
          quality: format.qualityLabel,
          format: format.container,
          size: format.contentLength,
          itag: format.itag
        }))
      };
    } catch (error) {
      console.error('Video info error:', error);
      throw new Error(`Failed to get video info: ${error.message}`);
    }
  }

  async downloadVideo(url, quality = 'highest') {
    let filePath = null;
    try {
      if (!ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL');
      }

      const info = await ytdl.getInfo(url, options);
      const videoTitle = info.videoDetails.title.replace(/[^\w\s]/gi, '');
      const fileName = `${Date.now()}-${videoTitle}.mp4`;
      filePath = path.join(this.tempDir, fileName);

      return new Promise((resolve, reject) => {
        const video = ytdl(url, {
          ...options,
          quality: quality === 'highest' ? 'highestvideo' : quality,
          filter: 'audioandvideo'
        });

        video.on('error', async (error) => {
          if (filePath) {
            await fs.promises.unlink(filePath).catch(err => 
              console.error('Error deleting failed download:', err)
            );
          }
          reject(new Error(`Download failed: ${error.message}`));
        });

        const writeStream = fs.createWriteStream(filePath);

        writeStream.on('error', async (error) => {
          if (filePath) {
            await fs.promises.unlink(filePath).catch(err => 
              console.error('Error deleting failed write:', err)
            );
          }
          reject(new Error(`File write failed: ${error.message}`));
        });

        video.pipe(writeStream);

        writeStream.on('finish', async () => {
          try {
            const result = await b2Service.uploadFile(
              filePath,
              fileName,
              'video/mp4'
            );

            // Ensure cleanup happens
            await fs.promises.unlink(filePath).catch(err => 
              console.error('Error deleting temp file after upload:', err)
            );

            resolve({
              title: videoTitle,
              fileName: fileName,
              ...result
            });
          } catch (error) {
            // Cleanup on upload error
            if (filePath) {
              await fs.promises.unlink(filePath).catch(err => 
                console.error('Error deleting failed upload:', err)
              );
            }
            reject(error);
          }
        });
      });
    } catch (error) {
      // Cleanup on any other error
      if (filePath) {
        await fs.promises.unlink(filePath).catch(err => 
          console.error('Error deleting on setup error:', err)
        );
      }
      throw new Error(`Download failed: ${error.message}`);
    }
  }
}

// Create instance with automatic cleanup
const service = new YouTubeService();

// Run cleanup every 24 hours
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
setInterval(() => service.cleanupTempFiles(), TWENTY_FOUR_HOURS);

// Run initial cleanup when service starts
service.cleanupTempFiles();

module.exports = service;


