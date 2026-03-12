const mongoose = require('mongoose');

const cuahang = require("./CuaHang");

const lichHenSchema = new mongoose.Schema({
    nguoiDung: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NguoiDung'
    },
    xe: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Xe'
    },
    ngayHen: { type: Date, required: true },
    gioHen: { type: String, required: true },
    cuaHang: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CuaHang'
    },
    trangThai: {
        type: String,
        enum: ['ChoXacNhan', 'DaXacNhan', 'DaDen', 'DaHuy'],
        default: 'ChoXacNhan'
    },
    ghiChu: String,
    ngayTao: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LichHen', lichHenSchema);