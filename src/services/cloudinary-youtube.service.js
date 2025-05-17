const ytdl = require('ytdl-core');
const fs = require('fs/promises');
const path = require('path');
const cloudinaryService = require('./cloudinary.service');
const { createWriteStream } = require('fs');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);

class CloudinaryYoutubeService {
  async validateYouTubeUrl(url) {
    return ytdl.validateURL(url);
  }

  async downloadVideo(youtubeUrl, quality = 'highest') {
    try {
      // Get video info
      const info = await ytdl.getInfo(youtubeUrl);
      const videoTitle = info.videoDetails.title;
      const sanitizedTitle = videoTitle.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
      
      // Create a unique filename
      const fileName = `youtube_${sanitizedTitle}_${Date.now()}.mp4`;
      const filePath = path.join(process.cwd(), 'uploads', fileName);
      
      // Download the video
      const video = ytdl(youtubeUrl, {
        quality: quality === 'highest' ? 'highestvideo' : 'lowestvideo'
      });
      
      const writeStream = createWriteStream(filePath);
      
      // Use pipeline for better error handling
      await pipeline(video, writeStream);
      
      // Upload to Cloudinary
      const result = await cloudinaryService.uploadFile(
        filePath,
        fileName,
        'video/mp4'
      );
      
      // Clean up the temporary file
      await fs.unlink(filePath);
      
      return {
        title: videoTitle,
        fileName: fileName,
        ...result
      };
    } catch (error) {
      console.error('YouTube download failed:', error);
      throw new Error(`Failed to process YouTube video: ${error.message}`);
    }
  }

  async downloadVideoWithProgress(youtubeUrl, quality = 'highest', progressCallback) {
    try {
      // Get video info
      const info = await ytdl.getInfo(youtubeUrl);
      const videoTitle = info.videoDetails.title;
      const sanitizedTitle = videoTitle.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
      
      // Create a unique filename
      const fileName = `youtube_${sanitizedTitle}_${Date.now()}.mp4`;
      const filePath = path.join(process.cwd(), 'uploads', fileName);
      
      // Get video format
      const format = quality === 'highest' 
        ? ytdl.chooseFormat(info.formats, { quality: 'highestvideo' })
        : ytdl.chooseFormat(info.formats, { quality: 'lowestvideo' });
      
      // Get total size if available
      const totalSize = format.contentLength ? parseInt(format.contentLength) : null;
      
      // Download the video with progress tracking
      return new Promise((resolve, reject) => {
        const video = ytdl(youtubeUrl, {
          quality: quality === 'highest' ? 'highestvideo' : 'lowestvideo'
        });
        
        const writeStream = createWriteStream(filePath);
        
        let downloadedBytes = 0;
        
        video.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          
          if (totalSize && progressCallback) {
            const percentage = Math.round((downloadedBytes / totalSize) * 100);
            progressCallback('download', percentage, downloadedBytes, totalSize);
          }
        });
        
        video.on('error', (error) => {
          reject(error);
        });
        
        writeStream.on('error', (error) => {
          reject(error);
        });
        
        writeStream.on('finish', async () => {
          try {
            // Upload to Cloudinary with progress tracking
            const result = await cloudinaryService.uploadFileWithProgress(
              filePath,
              fileName,
              'video/mp4',
              (percentage, uploaded, total) => {
                if (progressCallback) {
                  progressCallback('upload', percentage, uploaded, total);
                }
              }
            );
            
            // Clean up the temporary file
            await fs.unlink(filePath);
            
            resolve({
              title: videoTitle,
              fileName: fileName,
              ...result
            });
          } catch (error) {
            // Clean up on error
            await fs.unlink(filePath).catch(console.error);
            reject(error);
          }
        });
        
        video.pipe(writeStream);
      });
    } catch (error) {
      console.error('YouTube download failed:', error);
      throw new Error(`Failed to process YouTube video: ${error.message}`);
    }
  }
}

module.exports = new CloudinaryYoutubeService();
