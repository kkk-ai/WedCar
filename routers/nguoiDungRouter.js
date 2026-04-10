const express = require('express');
const router = express.Router();
const NguoiDung = require('../models/NguoiDung');
const bcrypt = require('bcryptjs');
const { requireLogin, requireAdmin } = require('../middlewares/auth');

function getSessionUserId(req) {
  return req.session?.user?._id || req.session?.user?.id || null;
}

function isAdmin(req) {
  return req.session?.user?.quyenHan === 'quanTri';
}

// Trang danh sách/cập nhật thông tin người dùng
router.get('/', requireLogin, async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    if (!userId) {
      return res.status(401).redirect('/auth/dang-nhap');
    }

    // Admin: xem danh sách tất cả người dùng
    // Khách hàng: xem chỉ thông tin của chính mình
    if (isAdmin(req)) {
      const nguoiDungList = await NguoiDung.find();
      res.render('nguoidung/danhSach', { 
        title: 'Quản Lý Người Dùng',
        nguoiDungList: nguoiDungList,
        isAdmin: true,
        user: req.session.user
      });
    } else {
      const currentUser = await NguoiDung.findById(userId);
      if (!currentUser) {
        return res.status(404).render('error', { message: 'Không tìm thấy thông tin người dùng' });
      }
      res.render('nguoidung/danhSach', { 
        title: 'Thông Tin Cá Nhân',
        currentUser: currentUser,
        isAdmin: false,
        user: req.session.user
      });
    }
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

// API: Lấy danh sách tất cả người dùng (JSON) - chỉ admin
router.get('/api/list', requireLogin, async (req, res) => {
  try {
    const isUserAdmin = isAdmin(req);
    if (!isUserAdmin) {
      return res.status(403).json({ message: 'Bạn không có quyền xem danh sách người dùng' });
    }

    const nguoiDungList = await NguoiDung.find();
    res.json(nguoiDungList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Trang thêm người dùng (chỉ admin)
router.get('/them', requireAdmin, (req, res) => {
  res.render('nguoidung/them', { title: 'Thêm người dùng' });
});

// Trang chỉnh sửa người dùng (chỉ admin)
router.get('/sua/:id', requireAdmin, async (req, res) => {
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

// Tạo người dùng mới (chỉ admin)
router.post('/', requireAdmin, async (req, res) => {
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
router.put('/:id', requireLogin, async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    const targetId = req.params.id;
    const isUserAdmin = isAdmin(req);

    // Kiểm tra quyền: khách hàng chỉ cập nhật thông tin của chính mình
    if (!isUserAdmin && String(userId) !== String(targetId)) {
      return res.status(403).json({ message: 'Bạn không có quyền cập nhật thông tin người dùng khác' });
    }

    const nguoiDung = await NguoiDung.findById(targetId);
    if (!nguoiDung) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    nguoiDung.hoTen = req.body.hoTen || nguoiDung.hoTen;
    nguoiDung.email = req.body.email || nguoiDung.email;
    nguoiDung.soDienThoai = req.body.soDienThoai || nguoiDung.soDienThoai;
    nguoiDung.diaChi = req.body.diaChi || nguoiDung.diaChi;
    
    // Chỉ admin được cập nhật quyền hạn
    if (isUserAdmin && req.body.quyenHan) {
      nguoiDung.quyenHan = req.body.quyenHan;
    }

    // Nếu có cập nhật mật khẩu, hash lại
    if (req.body.matKhau) {
      const salt = await bcrypt.genSalt(10);
      nguoiDung.matKhau = await bcrypt.hash(req.body.matKhau, salt);
    }

    const updatedNguoiDung = await nguoiDung.save();
    res.json({
      message: 'Cập nhật thông tin thành công',
      nguoiDung: updatedNguoiDung
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Xóa người dùng (chỉ admin)
router.delete('/:id', requireAdmin, async (req, res) => {
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