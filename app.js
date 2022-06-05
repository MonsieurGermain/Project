const express = require('express')
const mongoose = require('mongoose')
const ejs = require('ejs')
const passport = require('passport')
const session = require('express-session')
const flash = require('express-flash')
const methodOverride = require('method-override')
require('dotenv').config()

const app = express() 
require('./middlewares/passport')(passport);

mongoose.connect('mongodb://localhost:27017/project', {
    useNewUrlParser: true, useUnifiedTopology: true
});

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use(methodOverride('_method'))
app.use(express.static(__dirname + '/public'));
app.use(session({
      secret: process.env.SESSION_SECRET,
      resave: true,
      saveUninitialized: true,
      cookie : {maxAge : 5400000} // 1.5 hours
    })
  );
// FLASH MIDDLEWARE
app.use(flash());
app.use(passport.initialize())
app.use(passport.session())

app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.authuser = req.user
  res.locals.url = req.url
  res.locals.input_data = req.query
  next()
})


const { Auto_Delete_Expired_Message } = require('./middlewares/auto-delete')
Auto_Delete_Expired_Message

const HOME_ROUTER = require('./routes/home')
const LOGIN_ROUTER = require('./routes/login')
const DEL_PUT_CREATE_PRODUCT_ROUTER = require('./routes/manipulate-product')
const PROFILE = require('./routes/profile')
const PRODUCTS = require('./routes/products')
const ERROR = require('./routes/404') 
const MESSAGE = require('./routes/message')
const ORDER = require('./routes/order')
const REVIEW = require('./routes/review')
const SETTINGS = require('./routes/settings')
const ADMIN = require('./routes/admin')
const REPORT = require('./routes/report')


app.use('/', HOME_ROUTER)
app.use('/', LOGIN_ROUTER)
app.use('/', DEL_PUT_CREATE_PRODUCT_ROUTER)
app.use('/', PROFILE)
app.use('/', PRODUCTS)
app.use('/', ERROR)
app.use('/', MESSAGE)
app.use('/', ORDER)
app.use('/', REVIEW)
app.use('/', SETTINGS)
app.use('/', ADMIN)
app.use('/', REPORT)

// PRIORITY 
// PAGINATION
// XMR ESCROW
// FUZZY SEARCH
// ADMIN PAGE AND SYSTEM


// To do 
// fix product array and product img sizing

// Search for... Conversation, Product
// Totally hidden Message
// Encrypt Messages
// Saw or not saw message
// Register Saw or not saw
// Delete message after seing
// Format Currency of Product
// Discount Product
// Offline local 
// Dispute


// new CC(
// 	{
// 		from: 'BTC',
// 		to: 'EUR',
// 		amount: 2
// 	}
// ).convert().then((response)=>{
// 	console.log(2 + " " + 'USD' + " is equal to " + 
// 		response + " " + 'EUR');
// });


// Admin feature
// Validation & security
// Paying System

// function getValues(array, a = array[0]) {
//   console.log(a)
// }


//let array = [
//   {id : 'aa'},
//   {id : 'bb'},
//   {id : 'cc'},
// ]

// if (array.find((value) => value.id === "aa")) {
//   console.log("a")
// }
// const x = array.map(function(element) { return element.id; }).indexOf('zz');

// getValues(array)

// function Calculate_Price(base_price , qty, ship_opt_price, selection_1_price, selection_2_price) {

//   let price = (base_price + selection_1_price + selection_2_price) * qty + ship_opt_price
//   price += (price * 0.03)
//   price = price.toString()
//   price = price.slice(0, price.indexOf('.') + 3)

//   return parseFloat(price) 
// }

// console.log(Calculate_Price(20, 1, 5, 5, 5))

//update Message // IMG LINK RIGHT PLACE

// let time = 100.3234
// time = time.toString()
// time = time.slice(0, time.indexOf('.') + 0)
// console.log(time)


app.listen('3000', (req,res) => {
    console.log('Server running on port 3000')
})