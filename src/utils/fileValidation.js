const validVideoTypes = [
  'video/mp4',
  'video/mpeg',
  'video/x-matroska',  // MKV
  'video/x-msvideo',   // AVI
  'video/quicktime',   // MOV
  'video/webm',        // WebM
  'video/x-flv'        // FLV
];

const isVideoFile = (mimetype) => {
  return validVideoTypes.includes(mimetype);
};

module.exports = {
  isVideoFile,
  validVideoTypes
};