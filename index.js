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
const zaloPayRouter = require('./routers/zaloPayRouter');

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
app.use('/auth', authRouter);
app.use('/zalopay', zaloPayRouter);



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

//cổng
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})