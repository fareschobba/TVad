const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;
const fs = require('fs/promises');
const { promisify } = require('util');
const { createReadStream } = require('fs');
const streamifier = require('streamifier');

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

  async uploadFileWithProgress(filePath, fileName, contentType, progressCallback) {
    return new Promise((resolve, reject) => {
      // Create upload stream with progress monitoring
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          public_id: fileName.split('.')[0],
          folder: this.folder,
          overwrite: true
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          
          resolve({
            fileId: result.public_id,
            fileName: fileName,
            contentType: contentType,
            size: result.bytes,
            uploadDate: new Date().toISOString(),
            url: result.secure_url
          });
        }
      );

      // Create readable stream from file
      const readStream = createReadStream(filePath);
      
      // Track total file size and bytes uploaded
      const fileSize = fs.stat(filePath).then(stats => stats.size);
      let bytesUploaded = 0;
      
      // Monitor progress
      readStream.on('data', (chunk) => {
        bytesUploaded += chunk.length;
        
        fileSize.then(size => {
          const percentage = Math.round((bytesUploaded / size) * 100);
          if (progressCallback) {
            progressCallback(percentage, bytesUploaded, size);
          }
        });
      });

      // Handle errors
      readStream.on('error', (err) => reject(err));
      
      // Pipe the file to the upload stream
      readStream.pipe(uploadStream);
    });
  }

  async uploadBufferWithProgress(buffer, fileName, contentType, progressCallback) {
    return new Promise((resolve, reject) => {
      // Create upload stream with progress monitoring
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          public_id: fileName.split('.')[0],
          folder: this.folder,
          overwrite: true
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          
          resolve({
            fileId: result.public_id,
            fileName: fileName,
            contentType: contentType,
            size: result.bytes,
            uploadDate: new Date().toISOString(),
            url: result.secure_url
          });
        }
      );

      // Track total buffer size and bytes uploaded
      const bufferSize = buffer.length;
      let bytesUploaded = 0;
      
      // Create a readable stream from the buffer with progress tracking
      const bufferStream = streamifier.createReadStream(buffer);
      
      // Monitor progress
      bufferStream.on('data', (chunk) => {
        bytesUploaded += chunk.length;
        const percentage = Math.round((bytesUploaded / bufferSize) * 100);
        
        if (progressCallback) {
          progressCallback(percentage, bytesUploaded, bufferSize);
        }
      });

      // Handle errors
      bufferStream.on('error', (err) => reject(err));
      
      // Pipe the buffer stream to the upload stream
      bufferStream.pipe(uploadStream);
    });
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
