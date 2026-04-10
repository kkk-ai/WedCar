const express = require('express');
const router = express.Router();
const CuaHang = require('../models/CuaHang');

function parseGioMoCua(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { value: undefined };
  }

  if (typeof rawValue === 'string') {
    const value = rawValue.trim();
    const timeMatch = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

    if (timeMatch) {
      const hours = Number(timeMatch[1]);
      const minutes = Number(timeMatch[2]);
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return { value: date };
    }

    const parsedDate = new Date(value);
    if (!Number.isNaN(parsedDate.getTime())) {
      return { value: parsedDate };
    }

    return {
      error: 'Giờ mở cửa không hợp lệ. Vui lòng dùng định dạng HH:mm (ví dụ: 08:00).'
    };
  }

  const parsedDate = new Date(rawValue);
  if (!Number.isNaN(parsedDate.getTime())) {
    return { value: parsedDate };
  }

  return {
    error: 'Giờ mở cửa không hợp lệ. Vui lòng dùng định dạng HH:mm (ví dụ: 08:00).'
  };
}

function parseCoordinate(rawValue, min, max, fieldName) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { value: undefined };
  }

  const numericValue = Number(rawValue);
  if (Number.isNaN(numericValue)) {
    return { error: `${fieldName} phải là số hợp lệ.` };
  }

  if (numericValue < min || numericValue > max) {
    return { error: `${fieldName} phải nằm trong khoảng từ ${min} đến ${max}.` };
  }

  return { value: numericValue };
}

// Trang danh sách cửa hàng
router.get('/', async (req, res) => {
  try {
    const cuaHangList = await CuaHang.find();
    res.render('cuahang/danhSach', { 
      title: 'Danh sách cửa hàng',
      cuaHangList: cuaHangList 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// API: Lấy danh sách tất cả cửa hàng (JSON)
router.get('/api/list', async (req, res) => {
  try {
    const cuaHangList = await CuaHang.find();
    res.json(cuaHangList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Trang thêm cửa hàng
router.get('/them', (req, res) => {
  res.render('cuahang/them', { title: 'Thêm cửa hàng' });
});

// Trang chỉnh sửa cửa hàng
router.get('/sua/:id', async (req, res) => {
  try {
    const cuaHang = await CuaHang.findById(req.params.id);
    if (!cuaHang) {
      return res.status(404).render('404', { message: 'Không tìm thấy cửa hàng' });
    }
    res.render('cuahang/sua', { 
      title: 'Sửa cửa hàng',
      cuaHang: cuaHang 
    });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

// API: Lấy chi tiết một cửa hàng theo ID (JSON)
router.get('/chi-tiet/:id', async (req, res) => {
  try {
    const cuaHang = await CuaHang.findById(req.params.id);
    if (!cuaHang) {
      return res.status(404).json({ message: 'Không tìm thấy cửa hàng' });
    }
    res.json(cuaHang);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Tạo cửa hàng mới
router.post('/', async (req, res) => {
  try {
    // Kiểm tra email
    const emailExists = await CuaHang.findOne({ email: req.body.email.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({ message: 'Email đã được sử dụng' });
    }

    const parsedGioMoCua = parseGioMoCua(req.body.gioMoCua);
    if (parsedGioMoCua.error) {
      return res.status(400).json({ message: parsedGioMoCua.error });
    }

    const parsedLatitude = parseCoordinate(req.body.latitude, -90, 90, 'Vĩ độ');
    if (parsedLatitude.error) {
      return res.status(400).json({ message: parsedLatitude.error });
    }

    const parsedLongitude = parseCoordinate(req.body.longitude, -180, 180, 'Kinh độ');
    if (parsedLongitude.error) {
      return res.status(400).json({ message: parsedLongitude.error });
    }

    const cuaHang = new CuaHang({
      tenCuaHang: req.body.tenCuaHang.trim(),
      diaChi: req.body.diaChi?.trim(),
      soDienThoai: req.body.soDienThoai?.trim(),
      email: req.body.email.toLowerCase(),
      gioMoCua: parsedGioMoCua.value || new Date(),
      latitude: parsedLatitude.value,
      longitude: parsedLongitude.value
    });

    const newCuaHang = await cuaHang.save();
    res.status(201).json({
      message: 'Tạo cửa hàng thành công',
      cuaHang: newCuaHang
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Cập nhật cửa hàng
router.put('/:id', async (req, res) => {
  try {
    const cuaHang = await CuaHang.findById(req.params.id);
    if (!cuaHang) {
      return res.status(404).json({ message: 'Không tìm thấy cửa hàng' });
    }

    cuaHang.tenCuaHang = req.body.tenCuaHang?.trim() || cuaHang.tenCuaHang;
    cuaHang.diaChi = req.body.diaChi?.trim() || cuaHang.diaChi;
    cuaHang.soDienThoai = req.body.soDienThoai?.trim() || cuaHang.soDienThoai;
    
    // Nếu email thay đổi, kiểm tra email mới
    if (req.body.email && req.body.email.toLowerCase() !== cuaHang.email) {
      const emailExists = await CuaHang.findOne({ email: req.body.email.toLowerCase() });
      if (emailExists) {
        return res.status(400).json({ message: 'Email đã được sử dụng' });
      }
      cuaHang.email = req.body.email.toLowerCase();
    }

    const parsedGioMoCua = parseGioMoCua(req.body.gioMoCua);
    if (parsedGioMoCua.error) {
      return res.status(400).json({ message: parsedGioMoCua.error });
    }

    const parsedLatitude = parseCoordinate(req.body.latitude, -90, 90, 'Vĩ độ');
    if (parsedLatitude.error) {
      return res.status(400).json({ message: parsedLatitude.error });
    }

    const parsedLongitude = parseCoordinate(req.body.longitude, -180, 180, 'Kinh độ');
    if (parsedLongitude.error) {
      return res.status(400).json({ message: parsedLongitude.error });
    }

    if (parsedGioMoCua.value !== undefined) {
      cuaHang.gioMoCua = parsedGioMoCua.value;
    }

    if (parsedLatitude.value !== undefined) {
      cuaHang.latitude = parsedLatitude.value;
    }

    if (parsedLongitude.value !== undefined) {
      cuaHang.longitude = parsedLongitude.value;
    }

    const updatedCuaHang = await cuaHang.save();
    res.json({
      message: 'Cập nhật thành công',
      cuaHang: updatedCuaHang
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Xóa cửa hàng
router.delete('/:id', async (req, res) => {
  try {
    const cuaHang = await CuaHang.findById(req.params.id);
    if (!cuaHang) {
      return res.status(404).json({ message: 'Không tìm thấy cửa hàng' });
    }

    await CuaHang.deleteOne({ _id: req.params.id });
    res.json({ message: 'Đã xóa cửa hàng thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;