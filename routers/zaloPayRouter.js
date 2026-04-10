const express = require('express');
const router = express.Router();
const axios = require('axios').default;
const CryptoJS = require('crypto-js');
const moment = require('moment');
const qs = require('qs');
const DonHang = require('../models/DonHang');
const { requireLogin } = require('../middlewares/auth');

// ZaloPay Sandbox config
const config = {
  app_id: '2553',
  key1: 'PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL',
  key2: 'kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz',
  endpoint: 'https://sb-openapi.zalopay.vn/v2/create',
  // Thay bằng URL ngrok khi test callback, hoặc domain thực khi deploy
  callback_url: process.env.ZALOPAY_CALLBACK_URL || 'http://localhost:3000/zalopay/callback',
  redirect_url: process.env.ZALOPAY_REDIRECT_URL || 'http://localhost:3000/zalopay/result',
};

// ----------------------------------------------------------------
// POST /zalopay/payment
// Tạo đơn thanh toán ZaloPay cho đơn hàng đã có trong DB
// Body: { donHangId }
// ----------------------------------------------------------------
router.post('/payment', requireLogin, async (req, res) => {
  try {
    const { donHangId, soTienThanhToan } = req.body;
    if (!donHangId) {
      return res.status(400).json({ message: 'Thiếu donHangId' });
    }

    const donHang = await DonHang.findById(donHangId).populate('nguoiDung');
    if (!donHang) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const sessionUser = req.session?.user;
    const userId = sessionUser?._id || sessionUser?.id;
    const isAdmin = sessionUser?.quyenHan === 'quanTri';
    const isOwner = String(donHang.nguoiDung?._id || donHang.nguoiDung) === String(userId);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Bạn không có quyền thanh toán đơn hàng này' });
    }

    // Sử dụng soTienThanhToan nếu được gửi, nếu không dùng tongTien từ donHang
    const amount = Number(soTienThanhToan || donHang.tongTien || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Số tiền đơn hàng không hợp lệ để thanh toán ZaloPay' });
    }

    const transID = Math.floor(Math.random() * 1000000);
    const appTransId = `${moment().format('YYMMDD')}_${transID}`;

    const embed_data = {
      redirecturl: `${config.redirect_url}?donHangId=${donHangId}`,
    };

    const order = {
      app_id: config.app_id,
      app_trans_id: appTransId,
      app_user: donHang.nguoiDung ? donHang.nguoiDung._id.toString() : 'user',
      app_time: Date.now(),
      item: JSON.stringify([]),
      embed_data: JSON.stringify(embed_data),
      amount,
      callback_url: config.callback_url,
      description: `WedCar - Thanh toan don hang #${donHangId}`,
      bank_code: '',
    };

    // Tạo chữ ký MAC: appid|app_trans_id|appuser|amount|apptime|embeddata|item
    const macData =
      config.app_id + '|' +
      order.app_trans_id + '|' +
      order.app_user + '|' +
      order.amount + '|' +
      order.app_time + '|' +
      order.embed_data + '|' +
      order.item;
    order.mac = CryptoJS.HmacSHA256(macData, config.key1).toString();

    const result = await axios.post(config.endpoint, null, { params: order });

    if (result.data.return_code === 1) {
      await DonHang.findByIdAndUpdate(donHangId, {
        zaloPayTransId: appTransId,
        trangThaiThanhToan: 'DangXuLy',
        phuongThucThanhToan: 'ZaloPay',
      });
      return res.status(200).json({ order_url: result.data.order_url, app_trans_id: appTransId });
    } else {
      return res.status(400).json({ message: result.data.return_message || 'ZaloPay từ chối tạo đơn' });
    }
  } catch (error) {
    console.error('ZaloPay payment error:', error.message);
    return res.status(500).json({ message: 'Lỗi kết nối ZaloPay' });
  }
});

// ----------------------------------------------------------------
// POST /zalopay/callback
// ZaloPay Server gọi sau khi thanh toán hoàn tất
// ----------------------------------------------------------------
router.post('/callback', async (req, res) => {
  let result = {};
  try {
    const dataStr = req.body.data;
    const reqMac = req.body.mac;

    const mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();

    if (reqMac !== mac) {
      result.return_code = -1;
      result.return_message = 'mac not equal';
    } else {
      const dataJson = JSON.parse(dataStr);
      const appTransId = dataJson['app_trans_id'];

      await DonHang.findOneAndUpdate(
        { zaloPayTransId: appTransId },
        { trangThaiThanhToan: 'DaThanhToan', trangThai: 'DangXuLy' }
      );

      result.return_code = 1;
      result.return_message = 'success';
    }
  } catch (ex) {
    console.error('ZaloPay callback error:', ex.message);
    result.return_code = 0; // ZaloPay sẽ retry tối đa 3 lần
    result.return_message = ex.message;
  }

  res.json(result);
});

// ----------------------------------------------------------------
// GET /zalopay/result
// Trang kết quả sau khi ZaloPay redirect về
// ----------------------------------------------------------------
router.get('/result', async (req, res) => {
  const { donHangId } = req.query;
  try {
    const donHang = donHangId
      ? await DonHang.findById(donHangId).populate('nguoiDung').populate('danhSachXe.xe')
      : null;
    res.render('zalopay/result', { title: 'Kết quả thanh toán', donHang });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

// ----------------------------------------------------------------
// POST /zalopay/check-status
// Truy vấn trạng thái đơn ZaloPay theo app_trans_id
// Body: { app_trans_id }
// ----------------------------------------------------------------
router.post('/check-status', async (req, res) => {
  const { app_trans_id } = req.body;
  if (!app_trans_id) {
    return res.status(400).json({ message: 'Thiếu app_trans_id' });
  }

  const postData = {
    app_id: config.app_id,
    app_trans_id,
  };
  const macData = postData.app_id + '|' + postData.app_trans_id + '|' + config.key1;
  postData.mac = CryptoJS.HmacSHA256(macData, config.key1).toString();

  try {
    const result = await axios({
      method: 'post',
      url: 'https://sb-openapi.zalopay.vn/v2/query',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: qs.stringify(postData),
    });
    return res.status(200).json(result.data);
  } catch (error) {
    console.error('ZaloPay check-status error:', error.message);
    return res.status(500).json({ message: 'Lỗi kiểm tra trạng thái' });
  }
});

module.exports = router;
