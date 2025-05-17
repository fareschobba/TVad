const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin' ||req.user && req.user.role === 'SUPERADMIN' ) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin rights required.'
    });
  }
};

module.exports = { isAdmin };