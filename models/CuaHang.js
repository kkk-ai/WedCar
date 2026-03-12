const mongoose = require('mongoose');

const cuaHangSchema = new mongoose.Schema({
    tenCuaHang: { type: String, required: true },
    diaChi: String,
    soDienThoai: String,
    email: { type: String, required: true, unique: true },
    gioMoCua: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CuaHang', cuaHangSchema);