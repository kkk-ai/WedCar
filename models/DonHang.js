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
    thongTinKhachHang: {
        hoTen: { type: String, required: true },
        soDienThoai: { type: String, required: true },
        soCanCuoc: { type: String, required: true },
        maSoThue: { type: String, required: true }
    },
    hinhThucNhanXe: {
        type: String,
        enum: ['taiCuaHang', 'taiNha'],
        default: 'taiCuaHang'
    },
    cuaHangNhanXe: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CuaHang'
    },
    thongTinNhanXeTaiNha: {
        nguoiNhan: String,
        soDienThoaiNhan: String,
        diaChi: String,
        ghiChu: String
    },
    trangThai: {
        type: String,
        enum: ['ChoXacNhan', 'DangXuLy', 'HoanThanh', 'DaHuy'],
        default: 'ChoXacNhan'
    },
    phuongThucThanhToan: {
        type: String,
        enum: ['COD', 'ZaloPay'],
        default: 'COD'
    },
    ghiChu: {
        type: String,
        default: ''
    },
    trangThaiThanhToan: {
        type: String,
        enum: ['ChuaThanhToan', 'DangXuLy', 'DaThanhToan', 'ThatBai'],
        default: 'ChuaThanhToan'
    },
    zaloPayTransId: { type: String },
    ngayDat: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DonHang', donHangSchema);
