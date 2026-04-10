const mongoose = require('mongoose');

const cuaHangSchema = new mongoose.Schema({
    tenCuaHang: { type: String, required: true },
    diaChi: String,
    soDienThoai: String,
    email: { type: String, required: true, unique: true },
    gioMoCua: { type: Date, default: Date.now },
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 }
});

module.exports = mongoose.model('CuaHang', cuaHangSchema);