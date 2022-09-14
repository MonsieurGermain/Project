const express = require('express');
const mongoose = require('mongoose');
const ejs = require('ejs');
const passport = require('passport');
const session = require('express-session');
const flash = require('express-flash');
const methodOverride = require('method-override');
require('dotenv').config();

const app = express();
require('./middlewares/passport')(passport);

mongoose.connect('mongodb://localhost:27017/project', {
   useNewUrlParser: true,
   useUnifiedTopology: true,
});

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(methodOverride('_method'));
app.use(express.static(__dirname + '/public'));
app.use(
   session({
      secret: process.env.SESSION_SECRET ? process.env.SESSION_SECRET : 'secret',
      resave: true,
      saveUninitialized: true,
      cookie: {maxAge: 5400000}, // 1.5 hours
   })
);
// FLASH MIDDLEWARE
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
   res.locals.authuser = req.user;
   res.locals.query = req.query;
   const splitedUrl = req.url.split('?');
   res.locals.url = splitedUrl;
   res.locals.success = req.flash('success');
   res.locals.warning = req.flash('warning');
   res.locals.error = req.flash('error');
   next();
});

global.siteSettings = {
   autoPromote: true,
};

const {automaticly_EndSales, autoDelete_InactiveUser, Update_Order_ExpiredTimer, Auto_Check_Recieved_Payment, autoDeleteExpiredMessage} = require('./middlewares/databade-updating-function');
automaticly_EndSales;
autoDelete_InactiveUser; 
Update_Order_ExpiredTimer;
Auto_Check_Recieved_Payment; 
autoDeleteExpiredMessage;

const HOME_ROUTER = require('./routes/home');
const LOGIN_ROUTER = require('./routes/login');
const PROFILE = require('./routes/profile');
const PRODUCTS = require('./routes/products');
const ERROR = require('./routes/404');
const MESSAGE = require('./routes/message');
const ORDER = require('./routes/order');
const REVIEW = require('./routes/review');
const SETTINGS = require('./routes/settings');
const ADMIN = require('./routes/admin');
const DOCUMENTATION = require('./routes/documentation');

app.use('/', HOME_ROUTER);
app.use('/', LOGIN_ROUTER);
app.use('/', PROFILE);
app.use('/', PRODUCTS);
app.use('/', ERROR);
app.use('/', MESSAGE);
app.use('/', ORDER);
app.use('/', REVIEW);
app.use('/', SETTINGS);
app.use('/', ADMIN);
app.use('/', DOCUMENTATION);

const fileUpload = require("express-fileupload");

app.get('/test', (req, res) => {
   res.render('test')
});

app.post('/test', fileUpload(), (req, res) => {
   console.log(req.file)
   res.redirect('/test');
});

app.all('*', (req, res) => {
   res.render('404page');
});





app.listen('3000', (req, res) => {
   console.log('Server running on port 3000');
});
