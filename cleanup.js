const fs = require('fs').promises;
const path = require('path');

async function cleanupAllTempFiles() {
  const uploadsDir = path.join(__dirname, 'src/uploads');
  const youtubeDir = path.join(uploadsDir, 'youtube');

  try {
    // Clean main uploads directory
    await fs.rmdir(uploadsDir, { recursive: true });
    await fs.mkdir(uploadsDir);
    
    // Recreate youtube directory
    await fs.mkdir(youtubeDir);
    
    console.log('Successfully cleaned up all temporary files');
  } catch (err) {
    console.error('Error during cleanup:', err);
  }
}

cleanupAllTempFiles();