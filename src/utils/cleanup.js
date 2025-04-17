const fs = require('fs-extra');
const path = require('path');

const UPLOAD_DIRS = {
  main: path.join(process.cwd(), 'uploads'),
  youtube: path.join(process.cwd(), 'uploads', 'youtube'),
  temp: path.join(process.cwd(), 'temp')
};

const MAX_FILE_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

async function cleanupOldFiles(directory) {
  try {
    const files = await fs.readdir(directory);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(directory, file);
      try {
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > MAX_FILE_AGE) {
          await fs.remove(filePath);
          console.log(`Cleaned up old file: ${filePath}`);
        }
      } catch (err) {
        console.error(`Error processing file ${filePath}:`, err);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${directory}:`, err);
  }
}

async function ensureDirectoryExists(directory) {
  try {
    await fs.ensureDir(directory);
    console.log(`Ensured directory exists: ${directory}`);
  } catch (err) {
    console.error(`Error creating directory ${directory}:`, err);
  }
}

async function cleanupAllTempFiles() {
  console.log('Starting cleanup process:', new Date().toISOString());

  // Ensure all required directories exist
  for (const dir of Object.values(UPLOAD_DIRS)) {
    await ensureDirectoryExists(dir);
  }

  // Clean up old files in each directory
  await Promise.all([
    cleanupOldFiles(UPLOAD_DIRS.main),
    cleanupOldFiles(UPLOAD_DIRS.youtube),
    cleanupOldFiles(UPLOAD_DIRS.temp)
  ]);

  console.log('Cleanup process completed:', new Date().toISOString());
}

// Export the cleanup function and constants
module.exports = {
  cleanupAllTempFiles,
  UPLOAD_DIRS,
  MAX_FILE_AGE
};