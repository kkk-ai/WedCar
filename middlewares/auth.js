// Middleware để kiểm tra người dùng đã đăng nhập
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).redirect('/auth/dang-nhap');
  }
  next();
};

// Middleware để kiểm tra quyền quản trị
const requireAdmin = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).redirect('/auth/dang-nhap');
  }
  if (req.session.user.quyenHan !== 'quanTri') {
    return res.status(403).render('error', { message: 'Bạn không có quyền truy cập' });
  }
  next();
};

// Middleware để tạo biến global cho views
const userMiddleware = (req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
};

module.exports = {
  requireLogin,
  requireAdmin,
  userMiddleware
};
