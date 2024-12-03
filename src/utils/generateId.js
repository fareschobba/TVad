const generateRandomId = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const generateUniqueDeviceId = async (Device) => {
  let deviceId;
  let exists = true;
  
  while (exists) {
    deviceId = generateRandomId();
    // Check if this ID already exists
    exists = await Device.findOne({ deviceId });
  }
  
  return deviceId;
};

module.exports = { generateUniqueDeviceId };