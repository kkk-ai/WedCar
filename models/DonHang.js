const mongoose = require('mongoose');

const donHangSchema = new mongoose.Schema({
    nguoiDung: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NguoiDung',
        required: true
    },
    danhSachXe: [
        {
            xe: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Xe'
            },
            soLuong: { type: Number, default: 1 },
            giaTaiThoiDiemMua: Number
        }
    ],
    tongTien: Number,
    trangThai: {
        type: String,
        enum: ['ChoXacNhan', 'DangXuLy', 'HoanThanh', 'DaHuy'],
        default: 'ChoXacNhan'
    },
    ngayDat: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DonHang', donHangSchema);
