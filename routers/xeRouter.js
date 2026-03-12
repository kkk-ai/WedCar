const express = require('express');
const router = express.Router();
const Xe = require('../models/Xe');

function normalizeImagePart(img) {
  if (!img) return null;
  const trimmed = img.trim();
  if (!trimmed) return null;
  if (/^(https?:\/\/|\/)/i.test(trimmed)) {
    return trimmed;
  }
  return `/images/${trimmed.replace(/^\/+/, '')}`;
}

function normalizeImageArray(images) {
  if (!images) return [];
  const arr = Array.isArray(images)
    ? images
    : (typeof images === 'string' ? images.split(',') : []);
  return arr
    .map(i => normalizeImagePart(i))
    .filter(i => i);
}

// Trang danh sách xe
router.get('/', async (req, res) => {
  try {
    const xeList = await Xe.find();
    res.render('xe/danhSach', { 
      title: 'Danh sách xe',
      xeList: xeList 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// API: Lấy danh sách tất cả xe (JSON)
router.get('/api/list', async (req, res) => {
  try {
    const xeList = await Xe.find();
    res.json(xeList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Trang thêm xe
router.get('/them', (req, res) => {
  res.render('xe/them', { title: 'Thêm xe mới' });
});

// Trang chỉnh sửa xe
router.get('/sua/:id', async (req, res) => {
  try {
    const xe = await Xe.findById(req.params.id);
    if (!xe) {
      return res.status(404).render('404', { message: 'Không tìm thấy xe' });
    }
    res.render('xe/sua', { 
      title: 'Sửa thông tin xe',
      xe: xe 
    });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

// Giao diện chi tiết xe
router.get('/chi-tiet/:id', async (req, res) => {
  try {
    const xe = await Xe.findById(req.params.id);
    if (!xe) {
      return res.status(404).render('error', { message: 'Không tìm thấy xe' });
    }
    res.render('xe/chiTiet', {
      title: `Chi tiết xe: ${xe.tenXe}`,
      xe
    });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

// API: Lấy chi tiết một xe theo ID (JSON) cho API
router.get('/api/:id', async (req, res) => {
  try {
    const xe = await Xe.findById(req.params.id);
    if (!xe) {
      return res.status(404).json({ message: 'Không tìm thấy xe' });
    }
    res.json(xe);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Tạo xe mới
router.post('/', async (req, res) => {
  try {
    const {
      tenXe,
      hangXe,
      giaBan,
      namSanXuat,
      nhienLieu,
      hopSo,
      mauSac,
      moTa,
      hinhAnh,
      soLuongTon,
      noiBat,
      loaiXe
    } = req.body;

    // Validation
    if (!tenXe || !hangXe || !giaBan || !loaiXe) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
    }

    const xe = new Xe({
      tenXe: tenXe.trim(),
      hangXe: hangXe.trim(),
      giaBan: Number(giaBan),
      namSanXuat: namSanXuat ? Number(namSanXuat) : new Date().getFullYear(),
      nhienLieu,
      hopSo,
      mauSac: mauSac?.trim(),
      moTa: moTa?.trim(),
      hinhAnh: normalizeImageArray(hinhAnh),
      soLuongTon: soLuongTon ? Number(soLuongTon) : 1,
      noiBat: noiBat === 'true' || noiBat === true,
      loaiXe: loaiXe.trim()
    });

    const newXe = await xe.save();
    res.status(201).json({
      message: 'Tạo xe thành công',
      xe: newXe
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Cập nhật xe
router.put('/:id', async (req, res) => {
  try {
    const xe = await Xe.findById(req.params.id);
    if (!xe) {
      return res.status(404).json({ message: 'Không tìm thấy xe' });
    }

    const {
      tenXe,
      hangXe,
      giaBan,
      namSanXuat,
      nhienLieu,
      hopSo,
      mauSac,
      moTa,
      hinhAnh,
      soLuongTon,
      noiBat,
      loaiXe
    } = req.body;

    if (tenXe) xe.tenXe = tenXe.trim();
    if (hangXe) xe.hangXe = hangXe.trim();
    if (giaBan) xe.giaBan = Number(giaBan);
    if (namSanXuat) xe.namSanXuat = Number(namSanXuat);
    if (nhienLieu) xe.nhienLieu = nhienLieu;
    if (hopSo) xe.hopSo = hopSo;
    if (mauSac) xe.mauSac = mauSac.trim();
    if (moTa) xe.moTa = moTa.trim();
    if (hinhAnh) xe.hinhAnh = normalizeImageArray(hinhAnh);
    if (soLuongTon) xe.soLuongTon = Number(soLuongTon);
    if (noiBat !== undefined) xe.noiBat = noiBat === 'true' || noiBat === true;
    if (loaiXe) xe.loaiXe = loaiXe.trim();

    const updatedXe = await xe.save();
    res.json({
      message: 'Cập nhật thành công',
      xe: updatedXe
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Xóa xe
router.delete('/:id', async (req, res) => {
  try {
    const xe = await Xe.findById(req.params.id);
    if (!xe) {
      return res.status(404).json({ message: 'Không tìm thấy xe' });
    }

    await Xe.deleteOne({ _id: req.params.id });
    res.json({ message: 'Đã xóa xe thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;