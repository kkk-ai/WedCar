const express = require('express');
const router = express.Router();
const NguoiDung = require('../models/NguoiDung');
const bcrypt = require('bcryptjs');

// Trang đăng ký
router.get('/dang-ky', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/dangky', { title: 'Đăng Ký' });
});

// Trang đăng nhập
router.get('/dang-nhap', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/dangnhap', { title: 'Đăng Nhập' });
});

// Trang quên mật khẩu
router.get('/quen-mat-khau', (req, res) => {
  res.render('auth/quen-mat-khau', { title: 'Quên Mật Khẩu' });
});

// API: Đăng ký người dùng
router.post('/dang-ky', async (req, res) => {
  try {
    const { hoTen, email, matKhau, matKhauLai } = req.body;

    // Validation
    if (!hoTen || !email || !matKhau || !matKhauLai) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin' });
    }

    if (matKhau !== matKhauLai) {
      return res.status(400).json({ message: 'Mật khẩu không trùng khớp' });
    }

    if (matKhau.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    // Kiểm tra email đã tồn tại
    const emailExists = await NguoiDung.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({ message: 'Email đã được sử dụng' });
    }

    // Hash mật khẩu
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(matKhau, salt);

    // Tạo người dùng mới
    const newUser = new NguoiDung({
      hoTen: hoTen.trim(),
      email: email.toLowerCase(),
      matKhau: hashedPassword,
      quyenHan: 'khachHang'
    });

    const savedUser = await newUser.save();

    // Lưu session
    req.session.user = {
      id: savedUser._id,
      _id: savedUser._id,
      email: savedUser.email,
      hoTen: savedUser.hoTen,
      soDienThoai: savedUser.soDienThoai,
      diaChi: savedUser.diaChi,
      quyenHan: savedUser.quyenHan
    };

    res.json({
      message: 'Đăng ký thành công',
      user: req.session.user
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// API: Đăng nhập
router.post('/dang-nhap', async (req, res) => {
  try {
    const { email, matKhau } = req.body;

    if (!email || !matKhau) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu' });
    }

    // Tìm người dùng
    const user = await NguoiDung.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    // Kiểm tra mật khẩu
    const isPasswordValid = await bcrypt.compare(matKhau, user.matKhau);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    // Lưu session
    req.session.user = {
      id: user._id,
      _id: user._id,
      email: user.email,
      hoTen: user.hoTen,
      soDienThoai: user.soDienThoai,
      diaChi: user.diaChi,
      quyenHan: user.quyenHan
    };

    res.json({
      message: 'Đăng nhập thành công',
      user: req.session.user
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

function handleLogout(req, res, isApiResponse = true) {
  req.session.destroy((err) => {
    if (err) {
      if (isApiResponse) {
        return res.status(500).json({ message: 'Lỗi khi đăng xuất' });
      }
      return res.status(500).render('error', { message: 'Lỗi khi đăng xuất' });
    }

    res.clearCookie('connect.sid');

    if (isApiResponse) {
      return res.json({ message: 'Đăng xuất thành công' });
    }
    return res.redirect('/auth/dang-nhap');
  });
}

// API: Đăng xuất (AJAX)
router.post('/dang-xuat', (req, res) => {
  handleLogout(req, res, true);
});

// Đăng xuất qua đường dẫn trực tiếp
router.get('/dang-xuat', (req, res) => {
  handleLogout(req, res, false);
});

// API: Kiểm tra email tồn tại
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Vui lòng nhập email' });
    }

    const user = await NguoiDung.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'Email không tồn tại trong hệ thống' });
    }

    res.json({ message: 'Email hợp lệ' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi: ' + error.message });
  }
});

// API: Đặt lại mật khẩu mới
router.post('/reset-password-new', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Thiếu thông tin' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    const user = await NguoiDung.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'Email không tồn tại' });
    }

    // Hash mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Cập nhật mật khẩu
    user.matKhau = hashedPassword;
    await user.save();

    res.json({ message: 'Mật khẩu đã được cập nhật thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi: ' + error.message });
  }
});

module.exports = router;
