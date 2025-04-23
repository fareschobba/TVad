const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const crypto = require('crypto');

class B2Service {
  constructor() {
    this.applicationKeyId = "d7c95ef029b6";
    this.applicationKey = "0059cbe6c6c7dcf4c17d9d17409d5c106e1067a6b4";
    this.bucketId = "7dc7dcd9251e2f0092690b16";
    this.bucketName = "testSiter";
    
    this.authToken = null;
    this.apiUrl = null;
    this.downloadUrl = null;
    this.accountId = null;
    
    // Pool of upload URLs
    this.uploadUrlPool = [];
    this.maxPoolSize = 6; // Adjust based on your needs
    this.authExpiration = 0;
    this.uploadQueue = [];
    this.maxWaitTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    this.queueCheckInterval = 5000; // Check queue every second
  }

  async authorize() {
    if (this.authToken && Date.now() < this.authExpiration) {
      return;
    }

    try {
      const authString = Buffer.from(`${this.applicationKeyId}:${this.applicationKey}`).toString('base64');
      
      const response = await axios({
        method: 'GET',
        url: 'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',
        headers: {
          'Authorization': `Basic ${authString}`
        }
      });

      const { data } = response;
      console.log("data",data)
      this.authToken = data.authorizationToken;
      this.apiUrl = data.apiUrl;
      this.downloadUrl = data.downloadUrl;
      this.accountId = data.accountId;
      
      this.authExpiration = Date.now() + (23 * 60 * 60 * 1000);
      
      console.log('B2 authorization successful');
    } catch (error) {
        console.log(error)
      console.error('B2 authorization failed:', error.response?.data || error.message);
      throw new Error('Failed to authorize with B2');
    }
  }

  async getUploadUrlForPool() {
    await this.authorize();

    try {
      const response = await axios({
        method: 'POST',
        url: `${this.apiUrl}/b2api/v2/b2_get_upload_url`,
        headers: {
          'Authorization': this.authToken
        },
        data: {
          bucketId: this.bucketId
        }
      });

      const { data } = response;
      return {
        uploadUrl: data.uploadUrl,
        authorizationToken: data.authorizationToken,
        inUse: false,
        lastUsed: Date.now()
      };
    } catch (error) {
      console.error('Failed to get upload URL:', error.response?.data || error.message);
      throw new Error('Failed to get upload URL from B2');
    }
  }

  async getAvailableUploadUrl() {
    // Remove expired or errored URLs
    this.uploadUrlPool = this.uploadUrlPool.filter(url => 
      !url.error && (Date.now() - url.lastUsed) < 24 * 60 * 60 * 1000
    );

    // Find an available URL
    let uploadUrl = this.uploadUrlPool.find(url => !url.inUse);

    // If no available URL and pool not at max size, get new one
    if (!uploadUrl && this.uploadUrlPool.length < this.maxPoolSize) {
      uploadUrl = await this.getUploadUrlForPool();
      this.uploadUrlPool.push(uploadUrl);
    }

    // If still no URL, wait in queue
    if (!uploadUrl) {
      uploadUrl = await this.waitForAvailableUrl();
    }

    if (uploadUrl) {
      uploadUrl.inUse = true;
      return uploadUrl;
    }

    throw new Error('Failed to get upload URL after waiting 5 minutes');
  }

  async waitForAvailableUrl() {
    return new Promise((resolve, reject) => {
      const queueEntry = {
        resolve,
        reject,
        timestamp: Date.now()
      };

      this.uploadQueue.push(queueEntry);

      // Start queue processing if not already running
      if (this.uploadQueue.length === 1) {
        this.processQueue();
      }

      // Set timeout for 5 minutes
      setTimeout(() => {
        const index = this.uploadQueue.indexOf(queueEntry);
        if (index !== -1) {
          this.uploadQueue.splice(index, 1);
          reject(new Error('Timeout waiting for available upload URL'));
        }
      }, this.maxWaitTime);
    });
  }

  async processQueue() {
    if (this.uploadQueue.length === 0) return;

    const processNextInQueue = async () => {
      if (this.uploadQueue.length === 0) return;

      // Remove expired entries
      this.uploadQueue = this.uploadQueue.filter(entry => 
        (Date.now() - entry.timestamp) < this.maxWaitTime
      );

      if (this.uploadQueue.length === 0) return;

      // Try to find an available URL
      const availableUrl = this.uploadUrlPool.find(url => !url.inUse);
      
      if (availableUrl) {
        const nextInQueue = this.uploadQueue.shift();
        nextInQueue.resolve(availableUrl);
      }

      // Schedule next check
      setTimeout(() => processNextInQueue(), this.queueCheckInterval);
    };

    await processNextInQueue();
  }

  async uploadBuffer(buffer, fileName, contentType) {
    let uploadUrl;
    let queueStartTime;
    
    try {
      queueStartTime = Date.now();
      uploadUrl = await this.getAvailableUploadUrl();
      
      if (queueStartTime) {
        const waitTime = Date.now() - queueStartTime;
        console.log(`Upload waited in queue for ${waitTime}ms`);
      }

      const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');
    
      const uploadResponse = await axios({
        method: 'POST',
        url: uploadUrl.uploadUrl,
        headers: {
          'Authorization': uploadUrl.authorizationToken,
          'Content-Type': contentType,
          'X-Bz-File-Name': encodeURIComponent(fileName),
          'X-Bz-Content-Sha1': sha1
        },
        data: buffer
      });
    
      const { data } = uploadResponse;
      const downloadAuth = await this.getTemporaryDownloadAuth(data.fileName);
    
      // Mark URL as available and update last used time
      uploadUrl.inUse = false;
      uploadUrl.lastUsed = Date.now();
      
      return {
        fileId: data.fileId,
        fileName: data.fileName,
        contentType: contentType,
        size: data.contentLength,
        uploadDate: new Date().toISOString(),
        url: `${this.downloadUrl}/file/${this.bucketName}/${encodeURIComponent(data.fileName)}`, //?Authorization=${downloadAuth}
        queueTime: queueStartTime ? Date.now() - queueStartTime : 0
      };

    } catch (error) {
      if (uploadUrl) {
        if (error.response?.data?.code === 'expired_auth_token' ||
            error.response?.data?.code === 'bad_auth_token') {
          uploadUrl.error = true;
        }
        uploadUrl.inUse = false;
      }

      console.error('Upload failed:', {
        error: error.message,
        fileName,
        queueTime: queueStartTime ? Date.now() - queueStartTime : 0
      });
      
      throw error;
    }
  }

  async uploadFile(filePath, fileName, contentType) {
    const fileBuffer = await promisify(fs.readFile)(filePath);
    return this.uploadBuffer(fileBuffer, fileName, contentType);
  }
  
  async getTemporaryDownloadAuth(fileName, validDuration = 86400) {
    await this.authorize();
    const response = await axios({
      method: 'POST',
      url: `${this.apiUrl}/b2api/v2/b2_get_download_authorization`,
      headers: { 'Authorization': this.authToken },
      data: {
        bucketId: this.bucketId,
        fileNamePrefix: fileName,
        validDurationInSeconds: validDuration
      }
    });
    return response.data.authorizationToken;
  }

  async listFiles(startFileName = null, maxFileCount = 1000) {
    await this.authorize();

    try {
      const requestData = {
        bucketId: this.bucketId,
        maxFileCount: maxFileCount
      };

      if (startFileName) {
        requestData.startFileName = startFileName;
      }

      const response = await axios({
        method: 'POST',
        url: `${this.apiUrl}/b2api/v2/b2_list_file_names`,
        headers: {
          'Authorization': this.authToken
        },
        data: requestData
      });

      const { data } = response;
      
      const files = data.files.map(file => ({
        id: file.fileId,
        fileName: file.fileName,
        contentType: file.contentType,
        size: file.contentLength,
        uploadDate: new Date(file.uploadTimestamp).toISOString(),
        url: this.getDownloadUrl(file.fileName)
      }));

      if (data.nextFileName) {
        const nextFiles = await this.listFiles(data.nextFileName, maxFileCount);
        return [...files, ...nextFiles];
      }

      return files;
    } catch (error) {
      console.error('Failed to list files:', error.response?.data || error.message);
      throw new Error('Failed to list files from B2');
    }
  }

  async getFileInfo(fileId) {
    await this.authorize();

    try {
      const response = await axios({
        method: 'POST',
        url: `${this.apiUrl}/b2api/v2/b2_get_file_info`,
        headers: {
          'Authorization': this.authToken
        },
        data: {
          fileId: fileId
        }
      });

      return response.data;
    } catch (error) {
      console.error('Failed to get file info:', error.response?.data || error.message);
      throw new Error('Failed to get file info from B2');
    }
  }

  async downloadFile(fileId) {
    const fileInfo = await this.getFileInfo(fileId);
    const downloadUrl = this.getDownloadUrl(fileInfo.fileName);

    try {
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'arraybuffer'
      });

      return {
        content: response.data,
        contentType: fileInfo.contentType,
        fileName: fileInfo.fileName
      };
    } catch (error) {
      console.error('Failed to download file:', error.response?.data || error.message);
      throw new Error('Failed to download file from B2');
    }
  }

  async deleteFile(fileId) {
    await this.authorize();

    try {
      const fileInfo = await this.getFileInfo(fileId);
      
      const response = await axios({
        method: 'POST',
        url: `${this.apiUrl}/b2api/v2/b2_delete_file_version`,
        headers: {
          'Authorization': this.authToken
        },
        data: {
          fileId: fileId,
          fileName: fileInfo.fileName
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to delete file:', error.response?.data || error.message);
      throw new Error('Failed to delete file from B2');
    }
  }

  getDownloadUrl(fileName) {
    return `https://f002.backblazeb2.com/file/${this.bucketName}/${encodeURIComponent(fileName)}`;
  }

  async getAuthorizedDownloadUrl(fileId) {
    await this.authorize();
    
    const fileInfo = await this.getFileInfo(fileId);
    
    try {
      const response = await axios({
        method: 'POST',
        url: `${this.apiUrl}/b2api/v2/b2_get_download_authorization`,
        headers: {
          'Authorization': this.authToken
        },
        data: {
          bucketId: this.bucketId,
          fileNamePrefix: fileInfo.fileName,
          validDurationInSeconds: 86400
        }
      });

      const authToken = response.data.authorizationToken;
      return `${this.downloadUrl}/file/${this.bucketName}/${encodeURIComponent(fileInfo.fileName)}`; //?Authorization=${authToken}
    } catch (error) {
      console.error('Failed to get authorized download URL:', error.response?.data || error.message);
      throw new Error('Failed to get authorized download URL from B2');
    }
  }
}

module.exports = new B2Service();

