const mongoose = require('mongoose');

const xeSchema = new mongoose.Schema({
    tenXe: { type: String, required: true },
    hangXe: { type: String, required: true }, // Toyota, Honda...
    giaBan: { type: Number, required: true },
    namSanXuat: Number,
        nhienLieu: {
        type: String,
        enum: ['Xang', 'Dau', 'Dien', 'Hybrid']
    },
    hopSo: {
        type: String,
        enum: ['SoSan', 'SoTuDong']
    },
    mauSac: String,
    moTa: String,
    hinhAnh: [String],
    soLuongTon: { type: Number, default: 1 },
    noiBat: { type: Boolean, default: false },
    loaiXe: {type: String, required: true  },
    
});

module.exports = mongoose.model('Xe', xeSchema);