const fs = require('fs');
const path = require('path');

const ensureDirectories = () => {
  const directories = [
    'uploads',
    'uploads/temp',  // Optional: for temporary files
  ];

  directories.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`Created directory: ${fullPath}`);
    }
  });
};

module.exports = ensureDirectories;