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
      email: savedUser.email,
      hoTen: savedUser.hoTen,
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
      email: user.email,
      hoTen: user.hoTen,
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

// API: Đăng xuất
router.post('/dang-xuat', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi khi đăng xuất' });
    }
    res.json({ message: 'Đăng xuất thành công' });
  });
});

module.exports = router;
