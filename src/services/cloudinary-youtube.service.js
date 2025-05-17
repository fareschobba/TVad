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
}

module.exports = new CloudinaryYoutubeService();