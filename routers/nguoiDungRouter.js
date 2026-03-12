const express = require('express');
const router = express.Router();
const NguoiDung = require('../models/NguoiDung');
const bcrypt = require('bcryptjs');

// Trang danh sách người dùng
router.get('/', async (req, res) => {
  try {
    const nguoiDungList = await NguoiDung.find();
    res.render('nguoidung/danhSach', { 
      title: 'Danh sách người dùng',
      nguoiDungList: nguoiDungList 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// API: Lấy danh sách tất cả người dùng (JSON)
router.get('/api/list', async (req, res) => {
  try {
    const nguoiDungList = await NguoiDung.find();
    res.json(nguoiDungList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Trang thêm người dùng
router.get('/them', (req, res) => {
  res.render('nguoidung/them', { title: 'Thêm người dùng' });
});

// Trang chỉnh sửa người dùng
router.get('/sua/:id', async (req, res) => {
  try {
    const nguoiDung = await NguoiDung.findById(req.params.id);
    if (!nguoiDung) {
      return res.status(404).render('404', { message: 'Không tìm thấy người dùng' });
    }
    res.render('nguoidung/sua', { 
      title: 'Sửa người dùng',
      nguoiDung: nguoiDung 
    });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

// API: Lấy chi tiết một người dùng theo ID (JSON)
router.get('/chi-tiet/:id', async (req, res) => {
  try {
    const nguoiDung = await NguoiDung.findById(req.params.id);
    if (!nguoiDung) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    res.json(nguoiDung);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Tạo người dùng mới
router.post('/', async (req, res) => {
  // Kiểm tra email
  const emailExists = await NguoiDung.findOne({ email: req.body.email });
  if (emailExists) {
    return res.status(400).json({ message: 'Email đã tồn tại' });
  }

  // Hash mật khẩu trước khi lưu
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(req.body.matKhau, salt);

  const nguoiDung = new NguoiDung({
    hoTen: req.body.hoTen,
    email: req.body.email,
    matKhau: hashedPassword,
    soDienThoai: req.body.soDienThoai,
    diaChi: req.body.diaChi,
    quyenHan: req.body.quyenHan || 'khachHang'
  });

  try {
    const newNguoiDung = await nguoiDung.save();
    res.status(201).json({
      message: 'Tạo người dùng thành công',
      nguoiDung: newNguoiDung
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Cập nhật người dùng
router.put('/:id', async (req, res) => {
  try {
    const nguoiDung = await NguoiDung.findById(req.params.id);
    if (!nguoiDung) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    nguoiDung.hoTen = req.body.hoTen || nguoiDung.hoTen;
    nguoiDung.email = req.body.email || nguoiDung.email;
    nguoiDung.soDienThoai = req.body.soDienThoai || nguoiDung.soDienThoai;
    nguoiDung.diaChi = req.body.diaChi || nguoiDung.diaChi;
    nguoiDung.quyenHan = req.body.quyenHan || nguoiDung.quyenHan;

    // Nếu có cập nhật mật khẩu, hash lại
    if (req.body.matKhau) {
      const salt = await bcrypt.genSalt(10);
      nguoiDung.matKhau = await bcrypt.hash(req.body.matKhau, salt);
    }

    const updatedNguoiDung = await nguoiDung.save();
    res.json(updatedNguoiDung);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Xóa người dùng
router.delete('/:id', async (req, res) => {
  try {
    const nguoiDung = await NguoiDung.findById(req.params.id);
    if (!nguoiDung) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    await NguoiDung.deleteOne({ _id: req.params.id });
    res.json({ message: 'Đã xóa người dùng thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;