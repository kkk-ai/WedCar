const express = require('express');
const router = express.Router();
const DonHang = require('../models/DonHang');
const Xe = require('../models/Xe');
const { requireLogin } = require('../middlewares/auth');
const { sendInvoiceEmail, generateInvoicePdfBuffer } = require('../services/invoiceService');

function getSessionUserId(req) {
  return req.session?.user?._id || req.session?.user?.id || null;
}

function isAdmin(req) {
  return req.session?.user?.quyenHan === 'quanTri';
}

function calculateOrderSubtotal(danhSachXe = []) {
  if (!Array.isArray(danhSachXe) || danhSachXe.length === 0) {
    return 0;
  }

  return danhSachXe.reduce((sum, item) => {
    const soLuong = Number(item?.soLuong || 1);
    const gia = Number(item?.giaTaiThoiDiemMua || 0);
    const lineTotal = (Number.isFinite(soLuong) ? soLuong : 0) * (Number.isFinite(gia) ? gia : 0);
    return sum + lineTotal;
  }, 0);
}

// Trang danh sách đơn hàng
router.get('/', requireLogin, async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    const query = isAdmin(req) ? {} : { nguoiDung: userId };

    const donHangList = await DonHang.find(query)
      .populate('nguoiDung')
      .populate('danhSachXe.xe')
      .sort({ ngayDat: -1 });
    res.render('donhang/danhSach', { 
      title: 'Danh sách đơn hàng',
      donHangList: donHangList,
      user: req.session.user
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// API: Lấy danh sách đơn hàng (JSON)
router.get('/api/list', requireLogin, async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    const query = isAdmin(req) ? {} : { nguoiDung: userId };

    const donHangList = await DonHang.find(query)
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
router.get('/chi-tiet/:id', requireLogin, async (req, res) => {
  try {
    const donHang = await DonHang.findById(req.params.id)
      .populate('nguoiDung')
      .populate('danhSachXe.xe');
    if (!donHang) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const userId = getSessionUserId(req);
    const isOwner = donHang.nguoiDung && String(donHang.nguoiDung._id || donHang.nguoiDung) === String(userId);
    if (!isAdmin(req) && !isOwner) {
      return res.status(403).json({ message: 'Bạn không có quyền xem đơn hàng này' });
    }

    res.json(donHang);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Tải hóa đơn PDF
router.get('/:id/xuat-hoa-don', requireLogin, async (req, res) => {
  try {
    const donHang = await DonHang.findById(req.params.id)
      .populate('nguoiDung')
      .populate('danhSachXe.xe')
      .populate('cuaHangNhanXe');

    if (!donHang) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const userId = getSessionUserId(req);
    const isOwner = donHang.nguoiDung && String(donHang.nguoiDung._id || donHang.nguoiDung) === String(userId);
    if (!isAdmin(req) && !isOwner) {
      return res.status(403).json({ message: 'Bạn không có quyền xuất hóa đơn của đơn hàng này' });
    }

    if (donHang.trangThai !== 'HoanThanh') {
      return res.status(400).json({ message: 'Chỉ xuất hóa đơn khi đơn hàng đã Hoàn thành' });
    }

    const buffer = await generateInvoicePdfBuffer(donHang);
    const fileName = `hoa-don-${String(donHang._id).slice(-8).toUpperCase()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Tạo đơn hàng mới
router.post('/', requireLogin, async (req, res) => {
  try {
    const userId = getSessionUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Yêu cầu đăng nhập' });
    }

    const {
      danhSachXe,
      tongTien,
      phuongThucThanhToan,
      thongTinKhachHang,
      hinhThucNhanXe,
      cuaHangNhanXe,
      thongTinNhanXeTaiNha
    } = req.body;

    // Validation
    if (!danhSachXe || !Array.isArray(danhSachXe) || danhSachXe.length === 0) {
      return res.status(400).json({ message: 'Vui lòng chọn ít nhất một xe' });
    }

    if (!thongTinKhachHang || typeof thongTinKhachHang !== 'object') {
      return res.status(400).json({ message: 'Thiếu thông tin khách hàng' });
    }

    const hoTen = String(thongTinKhachHang.hoTen || '').trim();
    const soDienThoai = String(thongTinKhachHang.soDienThoai || '').trim();
    const soCanCuoc = String(thongTinKhachHang.soCanCuoc || '').trim();
    const maSoThue = String(thongTinKhachHang.maSoThue || '').trim();

    if (!hoTen || !soDienThoai || !soCanCuoc || !maSoThue) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ họ tên, số điện thoại, số căn cước và mã số thuế' });
    }

    const nhanXeMode = hinhThucNhanXe === 'taiNha' ? 'taiNha' : 'taiCuaHang';
    if (nhanXeMode === 'taiCuaHang' && !cuaHangNhanXe) {
      return res.status(400).json({ message: 'Vui lòng chọn cửa hàng nhận xe' });
    }

    if (nhanXeMode === 'taiNha') {
      const nguoiNhan = String(thongTinNhanXeTaiNha?.nguoiNhan || '').trim();
      const soDienThoaiNhan = String(thongTinNhanXeTaiNha?.soDienThoaiNhan || '').trim();
      const diaChi = String(thongTinNhanXeTaiNha?.diaChi || '').trim();

      if (!nguoiNhan || !soDienThoaiNhan || !diaChi) {
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin nhận xe tại nhà' });
      }
    }

    const vatRate = 0.1;
    const subTotalFromItems = calculateOrderSubtotal(danhSachXe);
    const fallbackSubtotal = Number(tongTien || 0);
    const subTotal = subTotalFromItems > 0 ? subTotalFromItems : (Number.isFinite(fallbackSubtotal) ? fallbackSubtotal : 0);
    const vatAmount = Math.round(subTotal * vatRate);
    const finalTotal = subTotal + vatAmount;

    const donHang = new DonHang({
      nguoiDung: userId,
      danhSachXe,
      tongTien: finalTotal,
      trangThai: 'ChoXacNhan',
      phuongThucThanhToan: phuongThucThanhToan || 'COD',
      thongTinKhachHang: {
        hoTen,
        soDienThoai,
        soCanCuoc,
        maSoThue
      },
      hinhThucNhanXe: nhanXeMode,
      cuaHangNhanXe: nhanXeMode === 'taiCuaHang' ? cuaHangNhanXe : undefined,
      thongTinNhanXeTaiNha: nhanXeMode === 'taiNha'
        ? {
            nguoiNhan: String(thongTinNhanXeTaiNha.nguoiNhan || '').trim(),
            soDienThoaiNhan: String(thongTinNhanXeTaiNha.soDienThoaiNhan || '').trim(),
            diaChi: String(thongTinNhanXeTaiNha.diaChi || '').trim(),
            ghiChu: String(thongTinNhanXeTaiNha.ghiChu || '').trim()
          }
        : undefined
    });

    const newDonHang = await donHang.save();
    await newDonHang.populate(['nguoiDung', 'danhSachXe.xe', 'cuaHangNhanXe']);
    
    res.status(201).json({
      message: 'Tạo đơn hàng thành công (đã cộng 10% VAT)',
      donHang: newDonHang,
      pricing: {
        subTotal,
        vatRate,
        vatAmount,
        finalTotal
      }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Cập nhật đơn hàng
router.put('/:id', async (req, res) => {
  try {
    const donHang = await DonHang.findById(req.params.id)
      .populate('nguoiDung')
      .populate('danhSachXe.xe')
      .populate('cuaHangNhanXe');
    if (!donHang) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const previousTrangThai = donHang.trangThai;

    const { danhSachXe, tongTien, trangThai, phuongThucThanhToan, ghiChu } = req.body;

    if (Array.isArray(danhSachXe)) donHang.danhSachXe = danhSachXe;
    if (tongTien !== undefined && tongTien !== null) donHang.tongTien = tongTien;
    if (trangThai !== undefined && trangThai !== null && trangThai !== '') donHang.trangThai = trangThai;
    if (phuongThucThanhToan !== undefined && phuongThucThanhToan !== null && phuongThucThanhToan !== '') {
      donHang.phuongThucThanhToan = phuongThucThanhToan;
    }
    if (ghiChu !== undefined) donHang.ghiChu = ghiChu;

    const updatedDonHang = await donHang.save();
    await updatedDonHang.populate(['nguoiDung', 'danhSachXe.xe', 'cuaHangNhanXe']);

    let invoiceMailResult = null;
    if (previousTrangThai !== 'HoanThanh' && updatedDonHang.trangThai === 'HoanThanh') {
      try {
        invoiceMailResult = await sendInvoiceEmail(updatedDonHang);
      } catch (mailError) {
        invoiceMailResult = { sent: false, reason: mailError.message };
      }
    }
    
    res.json({
      message: 'Cập nhật đơn hàng thành công',
      donHang: updatedDonHang,
      invoiceMail: invoiceMailResult
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