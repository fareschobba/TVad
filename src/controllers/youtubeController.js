const youtubeService = require('../services/youtube.service');

exports.getVideoInfo = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'Missing URL',
        message: 'YouTube URL is required'
      });
    }

    const isValid = await youtubeService.validateYouTubeUrl(url);
    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid URL',
        message: 'Please provide a valid YouTube URL'
      });
    }

    const videoInfo = await youtubeService.getVideoInfo(url);
    res.status(200).json({
      success: true,
      data: videoInfo
    });
  } catch (error) {
    console.error('Error getting video info:', error);
    res.status(500).json({
      error: 'Failed to get video info',
      message: 'Unable to retrieve video information. Please check the provided URL and try again.'
    });
  }
};

exports.downloadVideo = async (req, res) => {
  try {
    const { url, quality } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'Missing URL',
        message: 'YouTube URL is required'
      });
    }

    const isValid = await youtubeService.validateYouTubeUrl(url);
    if (!isValid) {
      return res.status(400).json({
        error: 'Invalid URL',
        message: 'Please provide a valid YouTube URL'
      });
    }

    const result = await youtubeService.downloadVideo(url, quality);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({
      error: 'Failed to download video',
      message: 'Unable to download the video. Please check the provided URL and try again.'
    });
  }
};