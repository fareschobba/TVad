const AdminUser = require('../models/adminUser');
const crypto = require('crypto');
const emailService = require('../services/email.service');

// Generate random password
const generatePassword = () => {
  return crypto.randomBytes(8).toString('hex');
};

// Create client account (admin only)
const createClient = async (req, res) => {
  try {
    const { username, email, phoneNumber } = req.body;
    const password = generatePassword();

    const client = await AdminUser.create({
      username,
      email,
      password,
      phoneNumber,
      role: 'client'
    });

    // Send welcome email with credentials
    await emailService.sendNewAccountEmail({
      email: client.email,
      username: client.username,
      password: password
    });

    res.status(201).json({
      success: true,
      message: 'Client account created successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Update client profile
const updateProfile = async (req, res) => {
  try {
    const { username, email, phoneNumber } = req.body;
    const userId = req.user.id;

    const user = await AdminUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.username = username || user.username;
    user.email = email || user.email;
    user.phoneNumber = phoneNumber || user.phoneNumber;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Toggle account status (admin only)
const toggleAccountStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await AdminUser.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    // // Send account status notification
    // await emailService.sendAccountStatusEmail({
    //   email: user.email,
    //   username: user.username,
    //   isActive: user.isActive
    // });

    res.status(200).json({
      success: true,
      message: `Account ${user.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const resetUserAccount = async (req, res) => {
  try {
    const { email } = req.body;
   
    if(!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if(req.user?.role) {
      
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Permission refusée. Droits administrateur requis.'
      });
    }
  }
    // Find the user by email
    const user = await AdminUser.findOne({ email, isDeleted: false });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Aucun utilisateur trouvé avec cet email'
      });
    }

    // Generate new temporary password
    const temporaryPassword = crypto.randomBytes(8).toString('hex');

    // Update user password and set flag to force password change on next login
    user.password = temporaryPassword;
    user.forcePasswordChange = true;
    await user.save();

    // Send reset email
    await emailService.sendAccountResetEmail({
      email: user.email,
      username: user.username,
      temporaryPassword: temporaryPassword
    });

    res.status(200).json({
      success: true,
      message: 'Compte réinitialisé avec succès. Un email a été envoyé à l\'utilisateur.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Erreur lors de la réinitialisation du compte: ${error.message}`
    });
  }
};

const changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Validate role
    if (!['admin', 'client'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role invalide. Les rôles autorisés sont: admin, client'
      });
    }

    // Find user
    const user = await AdminUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Prevent self-role change
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez pas modifier votre propre rôle'
      });
    }

    // Update role
    user.role = role;
    await user.save();


    res.status(200).json({
      success: true,
      message: `Rôle de l'utilisateur modifié avec succès en ${role}`,
      data: {
        userId: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Erreur lors du changement de rôle: ${error.message}`
    });
  }
};

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await AdminUser.find({ isDeleted: false })
      .select('-password')
      .lean();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get user with their videos
const getUserWithVideos = async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user
    const user = await AdminUser.findOne({ 
      _id: userId, 
      isDeleted: false 
    })
    .select('-password')
    .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Find all videos associated with this user
    const videos = await Advertisement.find({ 
      userId: userId,
      isDeleted: false 
    })
    .select('name description videoUrl orientation createdAt')
    .lean();

    res.status(200).json({
      success: true,
      data: {
        user,
        videos
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Modify the createAdvertisement function to include userId
const createAdvertisement = async (req, res) => {
  try {
    const { name, description, videoUrl, orientation } = req.body;
    
    // Add userId from authenticated user
    const userId = req.user._id;

    const advertisement = await Advertisement.create({
      name,
      description,
      videoUrl,
      orientation,
      userId
    });

    res.status(201).json({
      success: true,
      data: advertisement
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createClient,
  updateProfile,
  toggleAccountStatus,
  resetUserAccount,
  changeUserRole,
  getAllUsers,
  getUserWithVideos,
  createAdvertisement
};


