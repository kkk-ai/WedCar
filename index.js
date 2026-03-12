var express = require('express')
var app = express()
var port = 3000
var mongoose = require('mongoose');
const session = require('express-session');

// Import routers
const xeRouter = require('./routers/xeRouter');
const cuaHangRouter = require('./routers/cuaHangRouter');
const nguoiDungRouter = require('./routers/nguoiDungRouter');
const lichHenRouter = require('./routers/lichHenRouter');
const donHangRouter = require('./routers/donHangRouter');
const authRouter = require('./routers/authRouter');
const momoRouter = require('./routers/momoRouter');

// Model
const Xe = require('./models/Xe');

// Import middlewares
const { userMiddleware, requireAdmin, requireLogin } = require('./middlewares/auth');



//ket noi mongo
var uri = 'mongodb://nam472829:o4kw92KEUHwqznsH@ac-wncyd6x-shard-00-02.rkmeg1n.mongodb.net:27017,ac-wncyd6x-shard-00-01.rkmeg1n.mongodb.net:27017/WedCar?ssl=true&authSource=admin';
mongoose.connect(uri).then (() => {
	console.log('Thành công!!!!');
}) .catch(err => console.log(err));

const path = require('path');

//ejs
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files (css/js/images)
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
	secret: 'wedcar_secret_key_2026',
	resave: false,
	saveUninitialized: false,
	cookie: { 
		secure: false, // Set to true if using HTTPS
		maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
	}
}));

// User middleware - make user available in all views
app.use(userMiddleware);

// Use routers
app.use('/api/xe', xeRouter);
app.use('/api/cuahang', cuaHangRouter);
app.use('/api/nguoidung', nguoiDungRouter);
app.use('/api/lichhen', lichHenRouter);
app.use('/api/donhang', donHangRouter);
app.use('/api/momo', momoRouter);
app.use('/auth', authRouter);



app.get('/', async (req, res) => {
  try {
    const xeList = await Xe.find().sort({ tenXe: 1 }).lean();
    res.render('index', {
      title: 'Trang chủ',
      xeList
    });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin', {
    title: 'Trang quản trị'
  });
});

app.get('/khachhang', requireLogin, async (req, res) => {
  try {
    const xeId = req.query.xe;
    let selectedCar = null;
    if (xeId) {
      selectedCar = await Xe.findById(xeId).lean();
    }

    res.render('khachhang', {
      title: 'Trang khách hàng',
      selectedCar
    });
  } catch (error) {
    res.status(500).render('error', { message: error.message });
  }
});

app.post('/api/create-payment', async (req, res) => {
    try {
        const { xeId } = req.body;
        
        if (!xeId) {
            return res.status(400).json({ message: 'Thiếu thông tin xeId' });
        }

        const selectedCar = await Xe.findById(xeId);
        
        if (!selectedCar) {
            return res.status(404).json({ message: 'Không tìm thấy xe' });
        }

        console.log("Đang tạo đơn hàng MoMo cho xe:", selectedCar.tenXe);

        // Parameters
        var accessKey = 'F8BBA842ECF85';
        var secretKey = 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
        var orderInfo = 'Thanh toán xe ' + selectedCar.tenXe;
        var partnerCode = 'MOMO';
        var redirectUrl = 'http://localhost:3000/khachhang';
        var ipnUrl = 'https://webhook.site/b3088a6a-2d17-4f8d-a383-71389a6c600b';
        var requestType = "captureWallet";
        var amount = selectedCar.giaXe.toString();
        var orderId = partnerCode + new Date().getTime();
        var requestId = orderId;
        var extraData = '';
        var orderGroupId = '';
        var autoCapture = true;
        var lang = 'vi';

        // Signature
        var rawSignature = "accessKey=" + accessKey + "&amount=" + amount + "&extraData=" + extraData + "&ipnUrl=" + ipnUrl + "&orderId=" + orderId + "&orderInfo=" + orderInfo + "&partnerCode=" + partnerCode + "&redirectUrl=" + redirectUrl + "&requestId=" + requestId + "&requestType=" + requestType;
        
        const crypto = require('crypto');
        var signature = crypto.createHmac('sha256', secretKey)
            .update(rawSignature)
            .digest('hex');

        // Request body
        const requestBody = JSON.stringify({
            partnerCode : partnerCode,
            partnerName : "WedCar",
            storeId : "WedCarStore",
            requestId : requestId,
            amount : amount,
            orderId : orderId,
            orderInfo : orderInfo,
            redirectUrl : redirectUrl,
            ipnUrl : ipnUrl,
            lang : lang,
            requestType: requestType,
            autoCapture: autoCapture,
            extraData : extraData,
            orderGroupId: orderGroupId,
            signature : signature
        });

        // Send request to MoMo
        const https = require('https');
        const options = {
            hostname: 'test-payment.momo.vn',
            port: 443,
            path: '/v2/gateway/api/create',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        }

        const reqMoMo = https.request(options, response => {
            let data = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('Kết quả từ MoMo:', result); // Log để debug
                    
                    if (result.errorCode !== 0) {
                        return res.status(400).json({ message: result.localMessage || 'Lỗi thanh toán từ MoMo', detail: result });
                    }

                    res.json(result); // Trả về kết quả (bao gồm payUrl) cho frontend
                } catch (err) {
                    res.status(500).json({ message: 'Error parsing MoMo response' });
                }
            });
        });

        reqMoMo.on('error', (e) => {
            console.log(`Problem with request: ${e.message}`);
            res.status(500).json({ message: e.message });
        });

        reqMoMo.write(requestBody);
        reqMoMo.end();

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

//cổng
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})