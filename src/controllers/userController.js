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
    console.log(error);
    res.status(400).json({
      success: false,
      message: 'This user already exists or there was an error creating the account. Please try again with different credentials.'
    });
  }
};

// Update client profile
const updateProfile = async (req, res) => {
  try {
    const { username, email, phoneNumber,userId } = req.body;

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
    console.log(error)
    res.status(400).json({
      success: false,
      message: 'Failed to update profile. Please check your information and try again.'
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
      message: 'Unable to change account status. Please try again later.'
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
      message: 'Unable to reset account. Please verify the email address and try again.'
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
      message: 'Failed to change user role. Please try again later.'
    });
  }
};

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await AdminUser.find({ 
      isDeleted: false,
      role: { $ne: 'SUPERADMIN' } // Exclude SUPERADMIN users
    })
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
      message: 'Unable to retrieve user list. Please try again later.'
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

    let videos;
    
    // If user is admin, fetch all videos in the system
    if (user.role === 'admin') {
      videos = await Advertisement.find({ isDeleted: false })
        .select('name description videoUrl orientation createdAt status')
        .populate('userId', 'username email')
        .lean();
    } else {
      // For non-admin users, only show their own videos
      videos = await Advertisement.find({ 
        userId: userId,
        isDeleted: false 
      })
        .select('name description videoUrl orientation createdAt status')
        .populate('userId', 'username email')
        .lean();
    }

    res.status(200).json({
      success: true,
      data: {
        user,
        videos,
        totalVideos: videos.length,
        isAdminView: user.role === 'admin'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve user and video information. Please try again later.'
    });
  }
};

// Modify the createAdvertisement function to include userId
const createAdvertisement = async (req, res) => {
  try {
    const { name, description, videoUrl, orientation } = req.body;
    
    // Add userId from authenticated user
    const userId = req.user._id;

    const advertisement = await advertisement.create({
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
      message: 'Failed to create advertisement. Please check your input and try again.'
    });
  }
};

// Get current connected user
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await AdminUser.findOne({ 
      _id: userId, 
      isDeleted: false 
    })
    .select('username email phoneNumber role isActive createdAt')  // Explicitly select the fields we want
    .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Transform the response to include all necessary fields
    const userData = {
      _id: user._id,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isActive: user.isActive,
      isDeleted: user.isDeleted,
      createdAt: user.createdAt
    };

    res.status(200).json({
      success: true,
      data: userData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, email, phoneNumber, isActive, role } = req.body;

    // Check if user exists
    const user = await AdminUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-role change
    if (role && user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You cannot modify your own role'
      });
    }

    // Validate role if provided
    if (role && !['admin', 'client'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Allowed roles are: admin, client'
      });
    }

    // Update user fields
    const updates = {
      ...(username && { username }),
      ...(email && { email }),
      ...(phoneNumber && { phoneNumber }),
      ...(typeof isActive === 'boolean' && { isActive }),
      ...(role && { role })
    };

    // Update user
    const updatedUser = await AdminUser.findByIdAndUpdate(
      userId,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `This ${field} is already in use`
      });
    }

    res.status(500).json({
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
  createAdvertisement,
  getCurrentUser,
  updateUser
};


