const express = require('express');
const router = express.Router();
const LichHen = require('../models/LichHen');
const Xe = require('../models/Xe');
const CuaHang = require('../models/CuaHang');

// Trang danh sách lịch hẹn
router.get('/', async (req, res) => {
  try {
    const lichHenList = await LichHen.find()
      .populate('nguoiDung')
      .populate('xe')
      .populate('cuaHang')
      .sort({ ngayHen: -1 });
    res.render('lichhen/danhSach', { 
      title: 'Danh sách lịch hẹn',
      lichHenList: lichHenList 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// API: Lấy danh sách lịch hẹn (JSON)
router.get('/api/list', async (req, res) => {
  try {
    const lichHenList = await LichHen.find()
      .populate('nguoiDung')
      .populate('xe')
      .populate('cuaHang')
      .sort({ ngayHen: -1 });
    res.json(lichHenList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Trang thêm lịch hẹn
router.get('/them', async (req, res) => {
  try {
    const xeList = await Xe.find();
    const cuaHangList = await CuaHang.find();
    res.render('lichhen/them', { 
      title: 'Đặt lịch hẹn',
      xeList: xeList,
      cuaHangList: cuaHangList
    });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

// Trang sửa lịch hẹn
router.get('/sua/:id', async (req, res) => {
  try {
    const lichHen = await LichHen.findById(req.params.id)
      .populate('nguoiDung')
      .populate('xe')
      .populate('cuaHang');
    if (!lichHen) {
      return res.status(404).render('404', { message: 'Không tìm thấy lịch hẹn' });
    }
    const xeList = await Xe.find();
    const cuaHangList = await CuaHang.find();
    res.render('lichhen/sua', { 
      title: 'Sửa lịch hẹn',
      lichHen: lichHen,
      xeList: xeList,
      cuaHangList: cuaHangList
    });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

// API: Lấy chi tiết một lịch hẹn theo ID (JSON)
router.get('/chi-tiet/:id', async (req, res) => {
  try {
    const lichHen = await LichHen.findById(req.params.id)
      .populate('nguoiDung')
      .populate('xe')
      .populate('cuaHang');
    if (!lichHen) {
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn' });
    }
    res.json(lichHen);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Tạo lịch hẹn mới
router.post('/', async (req, res) => {
  try {
    const { nguoiDung, xe, ngayHen, gioHen, cuaHang, ghiChu } = req.body;

    // Validation
    if (!nguoiDung || !xe || !ngayHen || !gioHen || !cuaHang) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
    }

    const lichHen = new LichHen({
      nguoiDung,
      xe,
      ngayHen: new Date(ngayHen),
      gioHen,
      cuaHang,
      trangThai: 'ChoXacNhan',
      ghiChu: ghiChu?.trim()
    });

    const newLichHen = await lichHen.save();
    await newLichHen.populate(['nguoiDung', 'xe', 'cuaHang']);
    
    res.status(201).json({
      message: 'Đặt lịch hẹn thành công',
      lichHen: newLichHen
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Cập nhật lịch hẹn
router.put('/:id', async (req, res) => {
  try {
    const lichHen = await LichHen.findById(req.params.id);
    if (!lichHen) {
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn' });
    }

    const { nguoiDung, xe, ngayHen, gioHen, cuaHang, trangThai, ghiChu } = req.body;

    if (nguoiDung) lichHen.nguoiDung = nguoiDung;
    if (xe) lichHen.xe = xe;
    if (ngayHen) lichHen.ngayHen = new Date(ngayHen);
    if (gioHen) lichHen.gioHen = gioHen;
    if (cuaHang) lichHen.cuaHang = cuaHang;
    if (trangThai) lichHen.trangThai = trangThai;
    if (ghiChu) lichHen.ghiChu = ghiChu.trim();

    const updatedLichHen = await lichHen.save();
    await updatedLichHen.populate(['nguoiDung', 'xe', 'cuaHang']);
    
    res.json({
      message: 'Cập nhật lịch hẹn thành công',
      lichHen: updatedLichHen
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Xóa lịch hẹn
router.delete('/:id', async (req, res) => {
  try {
    const lichHen = await LichHen.findById(req.params.id);
    if (!lichHen) {
      return res.status(404).json({ message: 'Không tìm thấy lịch hẹn' });
    }

    await LichHen.deleteOne({ _id: req.params.id });
    res.json({ message: 'Đã xóa lịch hẹn thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;