const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;
const fs = require('fs/promises');
const { promisify } = require('util');

// Configure dotenv
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

class CloudinaryService {
  constructor() {
    this.folder = 'advertisements';
  }

  async uploadFile(filePath, fileName, contentType) {
    try {
      const uploadResult = await cloudinary.uploader.upload(filePath, {
        resource_type: 'video',
        public_id: fileName.split('.')[0],
        folder: this.folder,
        overwrite: true
      });

      return {
        fileId: uploadResult.public_id,
        fileName: fileName,
        contentType: contentType,
        size: uploadResult.bytes,
        uploadDate: new Date().toISOString(),
        url: uploadResult.secure_url
      };
    } catch (error) {
      console.error('Cloudinary upload failed:', error);
      throw new Error(`Failed to upload file to Cloudinary: ${error.message}`);
    }
  }

  async uploadBuffer(buffer, fileName, contentType) {
    // Create temporary file from buffer
    const tempPath = `./uploads/temp-${Date.now()}-${fileName}`;
    try {
      await fs.writeFile(tempPath, buffer);
      const result = await this.uploadFile(tempPath, fileName, contentType);
      await fs.unlink(tempPath);
      return result;
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch (unlinkError) {
        console.error('Failed to delete temp file:', unlinkError);
      }
      throw error;
    }
  }

  async deleteFile(fileId) {
    try {
      const result = await cloudinary.uploader.destroy(fileId, {
        resource_type: 'video'
      });
      
      return { success: result.result === 'ok' };
    } catch (error) {
      console.error('Failed to delete file from Cloudinary:', error);
      throw new Error(`Failed to delete file from Cloudinary: ${error.message}`);
    }
  }

  async getFileInfo(fileId) {
    try {
      const result = await cloudinary.api.resource(fileId, {
        resource_type: 'video'
      });
      
      return {
        fileId: result.public_id,
        fileName: result.public_id.split('/').pop(),
        contentType: result.resource_type,
        contentLength: result.bytes,
        uploadTimestamp: new Date(result.created_at).getTime()
      };
    } catch (error) {
      console.error('Failed to get file info from Cloudinary:', error);
      throw new Error(`Failed to get file info from Cloudinary: ${error.message}`);
    }
  }

  getDownloadUrl(fileId) {
    return cloudinary.url(fileId, {
      resource_type: 'video',
      secure: true
    });
  }
}

module.exports = new CloudinaryService();