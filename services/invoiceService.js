const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const FONT_REGULAR_PATH = path.join(__dirname, '..', 'public', 'fonts', 'NotoSans-Regular.ttf');
const FONT_BOLD_PATH = path.join(__dirname, '..', 'public', 'fonts', 'NotoSans-Bold.ttf');

function setupPdfFonts(doc) {
  const hasRegular = fs.existsSync(FONT_REGULAR_PATH);
  const hasBold = fs.existsSync(FONT_BOLD_PATH);

  if (hasRegular && hasBold) {
    doc.registerFont('VN-Regular', FONT_REGULAR_PATH);
    doc.registerFont('VN-Bold', FONT_BOLD_PATH);
    return { regular: 'VN-Regular', bold: 'VN-Bold' };
  }

  return { regular: 'Helvetica', bold: 'Helvetica-Bold' };
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN').format(Number(amount || 0));
}

function safeText(value, fallback = '-') {
  const text = String(value || '').trim();
  return text || fallback;
}

function buildInvoiceCode(donHang) {
  const idTail = String(donHang._id || '').slice(-6).toUpperCase();
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}-${idTail}`;
}

function getSellerInfo() {
  return {
    company: process.env.WEDCAR_COMPANY_NAME || 'CONG TY CO PHAN WEDCAR',
    address: process.env.WEDCAR_COMPANY_ADDRESS || 'TP. Ho Chi Minh, Viet Nam',
    phone: process.env.WEDCAR_COMPANY_PHONE || '1900 0000',
    taxCode: process.env.WEDCAR_COMPANY_TAX_CODE || '0312345678',
    email: process.env.WEDCAR_COMPANY_EMAIL || 'support@wedcar.vn'
  };
}

function getReceiveInfo(donHang) {
  if (donHang.hinhThucNhanXe === 'taiNha' && donHang.thongTinNhanXeTaiNha) {
    return {
      mode: 'Giao xe tai nha',
      name: safeText(donHang.thongTinNhanXeTaiNha.nguoiNhan),
      phone: safeText(donHang.thongTinNhanXeTaiNha.soDienThoaiNhan),
      address: safeText(donHang.thongTinNhanXeTaiNha.diaChi),
      note: safeText(donHang.thongTinNhanXeTaiNha.ghiChu, '')
    };
  }

  return {
    mode: 'Nhan xe tai cua hang',
    name: safeText(donHang.thongTinKhachHang?.hoTen || donHang.nguoiDung?.hoTen),
    phone: safeText(donHang.thongTinKhachHang?.soDienThoai || donHang.nguoiDung?.soDienThoai),
    address: safeText(donHang.cuaHangNhanXe?.diaChi || donHang.cuaHangNhanXe?.tenCuaHang),
    note: safeText(donHang.cuaHangNhanXe?.tenCuaHang, '')
  };
}

function generateInvoicePdfBuffer(donHang) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks = [];
    const font = setupPdfFonts(doc);

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const seller = getSellerInfo();
    const customer = donHang.thongTinKhachHang || {};
    const receiveInfo = getReceiveInfo(donHang);
    const invoiceCode = buildInvoiceCode(donHang);
    const now = new Date();

    const total = Number(donHang.tongTien || 0);
    const vatRate = 0.1;
    const subTotal = Math.round(total / (1 + vatRate));
    const vat = total - subTotal;

    doc.font(font.bold).fontSize(16).text('HOA DON GIA TRI GIA TANG', { align: 'center' });
    doc.moveDown(0.5);
    doc.font(font.regular).fontSize(10).text(`Số hóa đơn: ${invoiceCode}`, { align: 'right' });
    doc.text(`Ngày: ${now.toLocaleDateString('vi-VN')}`, { align: 'right' });

    doc.moveDown(0.8);
    const sellerBoxY = doc.y;
    doc.rect(36, sellerBoxY, 523, 78).stroke();
    doc.font(font.bold).fontSize(11).text(`Đơn vị bán hàng: ${seller.company}`, 44, sellerBoxY + 8);
    doc.font(font.regular).fontSize(10).text(`Địa chỉ: ${seller.address}`, 44, sellerBoxY + 24);
    doc.text(`Điện thoại: ${seller.phone}    MST: ${seller.taxCode}`, 44, sellerBoxY + 40);
    doc.text(`Email: ${seller.email}`, 44, sellerBoxY + 56);

    doc.moveDown(4.5);
    const customerBoxY = doc.y;
    doc.rect(36, customerBoxY, 523, 98).stroke();
    doc.font(font.bold).fontSize(11).text(`Người mua: ${safeText(customer.hoTen || donHang.nguoiDung?.hoTen)}`, 44, customerBoxY + 8);
    doc.font(font.regular).fontSize(10).text(`Số điện thoại: ${safeText(customer.soDienThoai || donHang.nguoiDung?.soDienThoai)}`, 44, customerBoxY + 24);
    doc.text(`Số căn cước: ${safeText(customer.soCanCuoc)}`, 44, customerBoxY + 40);
    doc.text(`Mã số thuế: ${safeText(customer.maSoThue)}`, 44, customerBoxY + 56);
    doc.text(`Hình thức nhận xe: ${receiveInfo.mode}`, 44, customerBoxY + 72);

    doc.moveDown(5.2);
    const startY = doc.y;
    const colX = [36, 68, 312, 368, 444, 560];
    doc.rect(36, startY, 523, 24).stroke();
    doc.text('STT', colX[0] + 8, startY + 7, { width: 24, align: 'center' });
    doc.text('Tên hàng hóa, dịch vụ', colX[1] + 6, startY + 7, { width: 236 });
    doc.text('SL', colX[2] + 8, startY + 7, { width: 44, align: 'center' });
    doc.text('Đơn giá', colX[3] + 6, startY + 7, { width: 70, align: 'right' });
    doc.text('Thành tiền', colX[4] + 6, startY + 7, { width: 108, align: 'right' });

    for (let i = 1; i < colX.length - 1; i += 1) {
      doc.moveTo(colX[i], startY).lineTo(colX[i], startY + 24).stroke();
    }

    let currentY = startY + 24;
    const items = Array.isArray(donHang.danhSachXe) ? donHang.danhSachXe : [];

    if (!items.length) {
      doc.rect(36, currentY, 523, 22).stroke();
      doc.text('1', colX[0] + 10, currentY + 6, { width: 20, align: 'center' });
      doc.text('Xe WedCar', colX[1] + 6, currentY + 6, { width: 236 });
      doc.text('1', colX[2] + 8, currentY + 6, { width: 44, align: 'center' });
      doc.text(formatCurrency(total), colX[3] + 6, currentY + 6, { width: 70, align: 'right' });
      doc.text(formatCurrency(total), colX[4] + 6, currentY + 6, { width: 108, align: 'right' });
      for (let i = 1; i < colX.length - 1; i += 1) {
        doc.moveTo(colX[i], currentY).lineTo(colX[i], currentY + 22).stroke();
      }
      currentY += 22;
    } else {
      items.forEach((item, index) => {
        const quantity = Number(item.soLuong || 1);
        const price = Number(item.giaTaiThoiDiemMua || 0);
        const lineTotal = quantity * price;
        const name = safeText(item.xe?.tenXe || 'Xe WedCar');

        doc.rect(36, currentY, 523, 22).stroke();
        doc.text(String(index + 1), colX[0] + 10, currentY + 6, { width: 20, align: 'center' });
        doc.text(name, colX[1] + 6, currentY + 6, { width: 236 });
        doc.text(String(quantity), colX[2] + 8, currentY + 6, { width: 44, align: 'center' });
        doc.text(formatCurrency(price), colX[3] + 6, currentY + 6, { width: 70, align: 'right' });
        doc.text(formatCurrency(lineTotal), colX[4] + 6, currentY + 6, { width: 108, align: 'right' });

        for (let i = 1; i < colX.length - 1; i += 1) {
          doc.moveTo(colX[i], currentY).lineTo(colX[i], currentY + 22).stroke();
        }
        currentY += 22;
      });
    }

    const totalsHeight = 66;
    doc.rect(36, currentY, 523, totalsHeight).stroke();
    doc.text('Cộng tiền hàng:', 320, currentY + 8, { width: 120, align: 'right' });
    doc.text(`${formatCurrency(subTotal)} VND`, 444, currentY + 8, { width: 108, align: 'right' });
    doc.text('Thuế VAT (10%):', 320, currentY + 26, { width: 120, align: 'right' });
    doc.text(`${formatCurrency(vat)} VND`, 444, currentY + 26, { width: 108, align: 'right' });
    doc.font(font.bold).text('Tổng thanh toán:', 320, currentY + 44, { width: 120, align: 'right' });
    doc.text(`${formatCurrency(total)} VND`, 444, currentY + 44, { width: 108, align: 'right' });
    doc.font(font.regular);

    doc.moveDown(5.2);
    doc.fontSize(10).text(`Nơi nhận xe: ${receiveInfo.address}`, 36, doc.y);
    if (receiveInfo.note) {
      doc.text(`Ghi chú nhận xe: ${receiveInfo.note}`, 36, doc.y + 14);
    }

    doc.moveDown(3);
    const signY = doc.y;
    doc.font(font.bold).text('Người mua hàng', 80, signY, { width: 150, align: 'center' });
    doc.font(font.bold).text('Người bán hàng', 360, signY, { width: 150, align: 'center' });
    doc.font(font.regular).text('(đã kí)', 400, signY + 16, { width: 70, align: 'center' });

    doc.end();
  });
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user, pass }
  });
}

async function sendInvoiceEmail(donHang) {
  const customerEmail = donHang?.nguoiDung?.email;
  if (!customerEmail) {
    return { sent: false, reason: 'Khach hang chua co email' };
  }

  const transporter = createTransporter();
  if (!transporter) {
    return { sent: false, reason: 'Chua cau hinh SMTP' };
  }

  const invoiceBuffer = await generateInvoicePdfBuffer(donHang);
  const invoiceCode = buildInvoiceCode(donHang);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: customerEmail,
    subject: `WedCar - Hoa don don hang ${donHang._id}`,
    html: `
      <p>Xin chao ${safeText(donHang.thongTinKhachHang?.hoTen || donHang.nguoiDung?.hoTen, 'Quy khach')},</p>
      <p>Don hang <strong>${donHang._id}</strong> da hoan thanh.</p>
      <p>WedCar gui kem hoa don VAT (PDF) trong email nay.</p>
      <p>Ma hoa don: <strong>${invoiceCode}</strong></p>
      <p>Cam on quy khach da su dung dich vu.</p>
    `,
    attachments: [
      {
        filename: `hoa-don-${invoiceCode}.pdf`,
        content: invoiceBuffer,
        contentType: 'application/pdf'
      }
    ]
  });

  return { sent: true };
}

module.exports = {
  sendInvoiceEmail,
  generateInvoicePdfBuffer
};
