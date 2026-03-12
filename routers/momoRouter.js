const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { requireLogin } = require('../middlewares/auth');
const DonHang = require('../models/DonHang');
const Xe = require('../models/Xe');

// Momo sandbox config
const MOMO_PARTNER_CODE = process.env.MOMO_PARTNER_CODE || 'MOMOX27K20240207';
const MOMO_ACCESS_KEY = process.env.MOMO_ACCESS_KEY || 'f9ZC7GqtDBxB2pn8';
const MOMO_SECRET_KEY = process.env.MOMO_SECRET_KEY || '9rQ8cFb2PXgiZqSHQ9DGk8a34qEY0g8p';
const MOMO_ENDPOINT = 'https://test-payment.momo.vn/v2/gateway/api/create';

// 1) checkout endpoint: create order + decrement stock + generate momo payUrl
router.post('/checkout', requireLogin, async (req, res) => {
  // Biến lưu tạm để rollback khi có lỗi
  let xeDoc = null;
  let savedOrderDoc = null;

  try {
    const { xeId } = req.body;
    if (!xeId) {
      return res.status(400).json({ message: 'Cần mã xe để thanh toán' });
    }

    const xe = await Xe.findById(xeId);
    if (!xe) {
      return res.status(404).json({ message: 'Xe không tồn tại' });
    }
    xeDoc = xe; // Lưu tham chiếu để rollback

    if (xe.soLuongTon <= 0) {
      return res.status(400).json({ message: 'Xe đã hết hàng' });
    }

    // giảm lượng tồn kho
    xe.soLuongTon -= 1;
    await xe.save();

    const donHang = new DonHang({
      nguoiDung: req.session.user.id,
      danhSachXe: [{ xe: xe._id, soLuong: 1, giaTaiThoiDiemMua: xe.giaBan }],
      tongTien: xe.giaBan,
      trangThai: 'ChoXacNhan'
    });
    const savedOrder = await donHang.save();
    savedOrderDoc = savedOrder; // Lưu tham chiếu để rollback

    // tạo request momo
    const amount = xe.giaBan.toString();
    const orderId = savedOrder._id.toString();
    const orderInfo = `Thanh toán xe ${xe.tenXe}`;
    const redirectUrl = `${req.protocol}://${req.get('host')}/khachhang`;
    const ipnUrl = `${req.protocol}://${req.get('host')}/api/momo/ipn`;
    const requestId = `${orderId}-${Date.now()}`;
    const requestType = "captureWallet";
    const extraData = '';

    // Chữ ký phải theo thứ tự a-z: accessKey, amount, extraData, ipnUrl, orderId, orderInfo, partnerCode, redirectUrl, requestId, requestType
    const rawSignature = `accessKey=${MOMO_ACCESS_KEY}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${MOMO_PARTNER_CODE}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    const signature = crypto.createHmac('sha256', MOMO_SECRET_KEY).update(rawSignature).digest('hex');

    const momoBody = {
      partnerCode: MOMO_PARTNER_CODE,
      partnerName: "WedCar",
      storeId: "WedCarStore",
      accessKey: MOMO_ACCESS_KEY,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang: 'vi',
      extraData,
      requestType,
      autoCapture: true,
      signature
    };

    const momoRes = await fetch(MOMO_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(momoBody)
    });

    const momoData = await momoRes.json();
    if (!momoRes.ok || momoData.errorCode !== 0) {
      // undo stock and order on momo error
      xe.soLuongTon += 1;
      await xe.save();
      await DonHang.findByIdAndDelete(savedOrder._id);
      return res.status(502).json({ message: 'Lỗi Momo, thử lại sau', details: momoData });
    }

    return res.json({ payUrl: momoData.payUrl, orderId: savedOrder._id });
  } catch (err) {
    console.error('Momo checkout error', err);

    // --- ROLLBACK LOGIC ---
    // Nếu đã lỡ tạo đơn hàng, xóa đi
    if (savedOrderDoc) {
      await DonHang.findByIdAndDelete(savedOrderDoc._id);
    }
    // Nếu đã lỡ trừ kho, cộng lại
    if (xeDoc) {
      await Xe.findByIdAndUpdate(xeDoc._id, { $inc: { soLuongTon: 1 } });
    }
    // ----------------------

    return res.status(500).json({ message: 'Lỗi máy chủ khi thanh toán Momo', details: err.message });
  }
});

// 2) IPN callback
router.post('/ipn', async (req, res) => {
  try {
    const { resultCode, orderId } = req.body;
    console.log('Momo IPN', req.body);

    if (!orderId) return res.status(400).json({ message: 'Thiếu orderId' });

    const donHang = await DonHang.findById(orderId).populate('danhSachXe.xe');
    if (!donHang) return res.status(404).json({ message: 'Đơn hàng không tồn tại' });

    if (resultCode === 0) {
      donHang.trangThai = 'HoanThanh';
      await donHang.save();
      return res.json({ message: 'OK' });
    }

    // Thanh toán không thành công, hoàn trả tồn kho
    donHang.trangThai = 'DaHuy';
    await donHang.save();

    for (const item of donHang.danhSachXe) {
      if (item.xe) {
        item.xe.soLuongTon = (item.xe.soLuongTon || 0) + item.soLuong;
        await item.xe.save();
      }
    }

    return res.status(400).json({ message: 'Thanh toán thất bại' });
  } catch (err) {
    console.error('Momo IPN error', err);
    return res.status(500).json({ message: 'Lỗi IPN Momo', details: err.message });
  }
});

module.exports = router;
