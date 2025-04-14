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
    try {
      if (!ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL');
      }

      const info = await ytdl.getInfo(url, options);
      const videoTitle = info.videoDetails.title.replace(/[^\w\s]/gi, '');
      const fileName = `${Date.now()}-${videoTitle}.mp4`;
      const filePath = path.join(this.tempDir, fileName);

      return new Promise((resolve, reject) => {
        const video = ytdl(url, {
          ...options,
          quality: quality === 'highest' ? 'highestvideo' : quality,
          filter: 'audioandvideo'
        });

        video.on('error', (error) => {
          console.error('Download error:', error);
          reject(new Error(`Download failed: ${error.message}`));
        });

        const writeStream = fs.createWriteStream(filePath);

        writeStream.on('error', (error) => {
          console.error('Write stream error:', error);
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

            fs.unlink(filePath, (err) => {
              if (err) console.error('Error deleting temp file:', err);
            });

            resolve({
              title: videoTitle,
              fileName: fileName,
              ...result
            });
          } catch (error) {
            console.error('Upload error:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Download setup error:', error);
      throw new Error(`Download failed: ${error.message}`);
    }
  }
}

module.exports = new YouTubeService();


