const express = require('express');
const router = express.Router();
const DonHang = require('../models/DonHang');
const Xe = require('../models/Xe');
const { requireLogin } = require('../middlewares/auth');

// Trang danh sách đơn hàng
router.get('/', async (req, res) => {
  try {
    const donHangList = await DonHang.find()
      .populate('nguoiDung')
      .populate('danhSachXe.xe')
      .sort({ ngayDat: -1 });
    res.render('donhang/danhSach', { 
      title: 'Danh sách đơn hàng',
      donHangList: donHangList 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// API: Lấy danh sách đơn hàng (JSON)
router.get('/api/list', async (req, res) => {
  try {
    const donHangList = await DonHang.find()
      .populate('nguoiDung')
      .populate('danhSachXe.xe')
      .sort({ ngayDat: -1 });
    res.json(donHangList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Trang thêm đơn hàng
router.get('/them', async (req, res) => {
  try {
    const xeList = await Xe.find();
    res.render('donhang/them', { 
      title: 'Tạo đơn hàng',
      xeList: xeList
    });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

// Trang sửa đơn hàng
router.get('/sua/:id', async (req, res) => {
  try {
    const donHang = await DonHang.findById(req.params.id)
      .populate('nguoiDung')
      .populate('danhSachXe.xe');
    if (!donHang) {
      return res.status(404).render('404', { message: 'Không tìm thấy đơn hàng' });
    }
    const xeList = await Xe.find();
    res.render('donhang/sua', { 
      title: 'Sửa đơn hàng',
      donHang: donHang,
      xeList: xeList
    });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

// API: Lấy chi tiết một đơn hàng
router.get('/chi-tiet/:id', async (req, res) => {
  try {
    const donHang = await DonHang.findById(req.params.id)
      .populate('nguoiDung')
      .populate('danhSachXe.xe');
    if (!donHang) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }
    res.json(donHang);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Tạo đơn hàng mới
router.post('/', requireLogin, async (req, res) => {
  try {
    const userId = req.session.user && req.session.user.id;
    if (!userId) {
      return res.status(401).json({ message: 'Yêu cầu đăng nhập' });
    }

    const { danhSachXe, tongTien, phuongThucThanhToan } = req.body;

    // Validation
    if (!danhSachXe || !Array.isArray(danhSachXe) || danhSachXe.length === 0) {
      return res.status(400).json({ message: 'Vui lòng chọn ít nhất một xe' });
    }

    const donHang = new DonHang({
      nguoiDung: userId,
      danhSachXe,
      tongTien: tongTien || 0,
      trangThai: 'ChoXacNhan',
      phuongThucThanhToan: phuongThucThanhToan || 'COD',
    });

    const newDonHang = await donHang.save();
    await newDonHang.populate(['nguoiDung', 'danhSachXe.xe']);
    
    res.status(201).json({
      message: 'Tạo đơn hàng thành công',
      donHang: newDonHang
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Cập nhật đơn hàng
router.put('/:id', async (req, res) => {
  try {
    const donHang = await DonHang.findById(req.params.id);
    if (!donHang) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const { danhSachXe, tongTien, trangThai } = req.body;

    if (danhSachXe) donHang.danhSachXe = danhSachXe;
    if (tongTien) donHang.tongTien = tongTien;
    if (trangThai) donHang.trangThai = trangThai;

    const updatedDonHang = await donHang.save();
    await updatedDonHang.populate(['nguoiDung', 'danhSachXe.xe']);
    
    res.json({
      message: 'Cập nhật đơn hàng thành công',
      donHang: updatedDonHang
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Xóa đơn hàng
router.delete('/:id', async (req, res) => {
  try {
    const donHang = await DonHang.findById(req.params.id);
    if (!donHang) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    await DonHang.deleteOne({ _id: req.params.id });
    res.json({ message: 'Đã xóa đơn hàng thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;