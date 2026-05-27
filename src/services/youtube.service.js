const ytdl = require('ytdl-core');
const path = require('path');
const fs = require('fs').promises; // Change to use fs.promises
const b2Service = require('./b2.service');
const { UPLOAD_DIRS } = require('../utils/cleanup');

const options = {
  requestOptions: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  }
};

// SSRF defense: only allow genuine YouTube hosts (ytdl trusts whatever URL it's given).
const ALLOWED_YT_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
  'youtu.be', 'www.youtu.be'
]);
// DoS defense: cap video length and download size so a long/huge video can't fill the disk.
const MAX_DURATION_SECONDS = 60 * 60;            // 1 hour
const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024;    // 500 MB

function isAllowedYouTubeUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_YT_HOSTS.has(host);
  } catch {
    return false;
  }
}

class YouTubeService {
  constructor() {
    this.tempDir = UPLOAD_DIRS.temp;
  }

  async cleanupTempFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        try {
          const stats = await fs.stat(filePath);
          if (stats.ctimeMs < twentyFourHoursAgo) {
            await fs.unlink(filePath); // Changed from fs.remove to fs.unlink
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
      return isAllowedYouTubeUrl(url) && ytdl.validateURL(url);
    } catch (error) {
      return false;
    }
  }

  async getVideoInfo(url) {
    try {
      if (!isAllowedYouTubeUrl(url) || !ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL');
      }

      const info = await ytdl.getInfo(url, options);
      if (parseInt(info.videoDetails.lengthSeconds) > MAX_DURATION_SECONDS) {
        throw new Error('Video exceeds the maximum allowed duration');
      }
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
      if (!isAllowedYouTubeUrl(url) || !ytdl.validateURL(url)) {
        throw new Error('Invalid YouTube URL');
      }

      const info = await ytdl.getInfo(url, options);
      if (parseInt(info.videoDetails.lengthSeconds) > MAX_DURATION_SECONDS) {
        throw new Error('Video exceeds the maximum allowed duration');
      }
      const videoTitle = info.videoDetails.title.replace(/[^\w\s]/gi, '');
      const fileName = `${Date.now()}-${videoTitle}.mp4`;
      filePath = path.join(this.tempDir, fileName);

      return new Promise((resolve, reject) => {
        const video = ytdl(url, {
          ...options,
          quality: quality === 'highest' ? 'highestvideo' : quality,
          filter: 'audioandvideo'
        });

        // Abort if the stream exceeds the size cap (disk-fill DoS guard).
        let downloadedBytes = 0;
        video.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (downloadedBytes > MAX_DOWNLOAD_BYTES) {
            video.destroy(new Error('Video exceeds the maximum allowed size'));
          }
        });

        video.on('error', async (error) => {
          if (filePath) {
            await fs.unlink(filePath).catch(err => 
              console.error('Error deleting failed download:', err)
            );
          }
          reject(new Error(`Download failed: ${error.message}`));
        });

        // Need to use regular fs for createWriteStream
        const writeStream = require('fs').createWriteStream(filePath);

        writeStream.on('error', async (error) => {
          if (filePath) {
            await fs.unlink(filePath).catch(err => 
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
            await fs.unlink(filePath).catch(err => 
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
              await fs.unlink(filePath).catch(err => 
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
        await fs.unlink(filePath).catch(err => 
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




