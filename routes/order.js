const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const Order = require('../models/order');
const User = require('../models/user');
const {Need_Authentification} = require('../middlewares/authentication');
const { Validate_OrderCustomization, sanitizeParams, sanitizeQuerys, sanitizeParamsQuerys} = require('../middlewares/validation');
const {formatUsernameWithSettings, paginatedResults, sanitizeHTML} = require('../middlewares/function');


function calculateOrderPrice(base_price, qty, ship_opt_price, selection_1_price, selection_2_price) {
   let price = (((base_price + selection_1_price + selection_2_price) * qty)  + ship_opt_price);

   price += price * 0.03

   price = price.toString(); 

   return parseFloat(price.slice(0, price.indexOf('.') + 3));
}

async function HandleOrderRequest(request, order, user_settings) {
   switch (request) {
      case 'shipped':
         order.status = request;
         order.reset_left = 3;
         order.timer = Date.now() + 604800000; // 1weeks
         break;
      case 'recieved':
         order.status = request;
         order.timer = Date.now() + 172800000; // 2days
         break;
      case 'finished':
         order.status = 'finalized';
         await order.Apply_buyerDeleteInfo(user_settings);
         break;
      case 'rejected':
         order.Reject_Order(user_settings);
         break;
      case 'not_recieved':
         order.Reset_Timer();
         break;
   }
   return order;
}

// Better Name ?
function getDaysHoursEtc(number, Timer, Time_Left, Time_Amount) {
   let value = Timer / number;
   value = value.toString();
   value = value.slice(0, value.indexOf('.') + 0);
   Timer += -(value * number);
   Time_Left = Time_Left + ` ${value}${Time_Amount}`;

   return [Timer, Time_Left];
}

function Format_Timer(timer) {
   let Time_Left = '';
   let Timer = timer - Date.now();

   [Timer, Time_Left] = getDaysHoursEtc(86400000, Timer, Time_Left, 'Days');
   [Timer, Time_Left] = getDaysHoursEtc(3600000, Timer, Time_Left, 'Hours');
   [Timer, Time_Left] = getDaysHoursEtc(60000, Timer, Time_Left, 'Mins');
   [Timer, Time_Left] = getDaysHoursEtc(1000, Timer, Time_Left, 'Secs');

   return Time_Left;
}

async function getProductImg(slug) {
   const product = await Product.findOne({slug: slug});
   return product.img_path[0];
}

function Create_Order_Link(status, id, isBuyer) {
   if (isBuyer) {
      if (status === 'awaiting_info') return `/submit-info/${id}`;
      if (status === 'awaiting_payment') return `/pay/${id}`;
   }
   return `/order-resume/${id}`;
}

function addDeleteLink(order, isBuyer) {
   switch (order.status) {
      case 'rejected':
         if (isBuyer) return true;
         return;
      case 'finalized':
         return true;
      case 'expired':
         return true;
      case 'awaiting_info':
         if (isBuyer) return true;
         return;
      case 'disputed':
         if (isBuyer && order.dispute_winner === order.buyer) return true;
         if (!isBuyer && order.dispute_winner === order.vendor) return true;
         if (!order.timer) return true;
         return;
   }
   return;
}
async function formatOrder(order, isBuyer) {
   order.buyer = formatUsernameWithSettings(order.buyer, order.privacy);

   if (order.timer > Date.now()) order.Formated_Timers = Format_Timer(order.timer);

   order.link = Create_Order_Link(order.status, order.id, isBuyer);

   order.deletelink = addDeleteLink(order, isBuyer);
   
   order.product_img = await getProductImg(order.product_slug);

   return order;
}

async function arrayFormat_Order(orders, isBuyer) {
   for (let i = 0; i < orders.length; i++) {
      orders[i] = await formatOrder(orders[i], isBuyer);
   }
   return orders;
}

// Routes
router.get('/order/:slug', Need_Authentification, sanitizeParams, async (req, res) => {
   try {
      const product = await Product.findOne({slug: req.params.slug});

      if (product.status === 'offline' && product.vendor !== req.user.username) throw new Error('Product Offline');
      
      const vendor = await User.findOne({username: product.vendor});

      res.render('order', {product, vendor});
   } catch (e) {
      res.redirect('/404');
   }
});

async function getVendorMoneroAddress(vendorUsername) {
   const vendor = await User.findOne({username: vendorUsername})

   if (vendor.vendorMoneroAddress) return vendor.vendorMoneroAddress;
   else throw new Error('Invalid Vendor')
}

router.post('/create-order/:slug', Need_Authentification, sanitizeParams, 
async (req,res, next) => {
   try { 
      req.product = await Product.findOne({slug: req.params.slug, status: 'online'}).orFail(new Error('Invalid Slug Params'));

      next()
   } catch (e) {
      res.redirect('/404')
   }
},
Validate_OrderCustomization, async (req, res) => {
   try {
      const {product} = req;
      let {qty, shipping_option, selection_1, selection_2, type} = req.body;

      qty = qty > 1 ? qty : 1;
      if (product.qty_settings.available_qty) product.qty_settings.available_qty += -qty;

      const order = new Order({
         buyer: req.user.username,
         vendor: product.vendor,
         product_title: product.title,
         product_slug: product.slug,
         base_price: product.salesPrice ? product.salesPrice : product.price,
         total_price: product.price,
         status: 'awaiting_info',
         timer: Date.now() + 30 * 60 * 1000, // 30min
         privacy: type,
         qty: qty,
         selection_1,
         selection_2,
         shipping_option,
      });

      order.orderMoneroAddress = product.customMoneroAddress ? product.customMoneroAddress : await getVendorMoneroAddress(product.vendor)

      order.total_price = calculateOrderPrice(
         order.base_price,
         order.qty,
         order.shipping_option ? order.shipping_option.option_price : 0,
         order.selection_1?.selected_choice.choice_price ? order.selection_1.selected_choice.choice_price : 0,
         order.selection_2?.selected_choice.choice_price ? order.selection_2.selected_choice.choice_price : 0
      );

      if (order.total_price < 1) throw new Error('Each orders need to cost at least 1$')  

      await product.save();
      await order.save();

      res.redirect(`/submit-info/${order.id}`);
   } catch (e) {
      console.log(e);
      req.flash('error', e.message)
      res.redirect(`/order/${req.product.slug}`);
   }
});

router.get('/submit-info/:id', Need_Authentification, sanitizeParams, async (req, res) => {
   try {
      const order = await Order.findByIdwhereYouBuyer(req.params.id, req.user.username)

      const product = await Product.findOne({slug: order.product_slug});
      const user = await User.findOne({username: order.vendor});

      if (product.message) product.message = sanitizeHTML(product.message);

      res.render('submit-info', {order, product, vendor: user});
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});

router.post('/submit-info/:id', Need_Authentification, sanitizeParams, async (req, res) => {
   try {
      const {user} = req
      const {content} = req.body

      if (!content || typeof(content) !== 'string' || content.length < 2 || content.length > 3000) throw new Error('Invalid Submited Information')

      const order = await Order.findByIdwhereYouBuyer(req.params.id, req.user.username)

      order.messages.push({
         sender: user.username === order.buyer ? formatUsernameWithSettings(user.username, order.privacy) : user.username,
         content
      });

      order.status = 'awaiting_payment';
      order.timer = Date.now() + 1000 * 60 * 60;

      await order.save();

      res.redirect(`/pay/${order.id}`);
   } catch (e) {
      req.flash('error', e.message)
      res.redirect(`/submit-info/${req.params.id}`);
   }
});

router.post('/send-order-message/:id', Need_Authentification, sanitizeParams, async (req,res) => {
   try {
      const {user} = req
      const {message} = req.body

      if (!message || typeof(message) !== 'string' || message.length < 2 || message.length > 3000) throw new Error('Invalid Message')

      const order = await Order.findByIdwhereYouBuyerVendorAdmin(req.params.id, req.user.username)

      order.messages.push({
         sender: user.username === order.buyer ? formatUsernameWithSettings(user.username, order.privacy) : user.username,
         content: message
      });

      await order.save();

      res.redirect(`/order-resume/${order.id}`);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
})

router.get('/pay/:id', Need_Authentification, sanitizeParams, async (req, res) => {
   try {
      const order = await Order.findByIdwhereYouBuyer(req.params.id, req.user.username)

      res.render('pay', {order});
   } catch (e) {
      res.redirect('/404');
   }
});

router.get('/order-resume/:id', Need_Authentification, sanitizeParams, async (req, res) => {
   try {
      let order = await Order.findByIdwhereYouBuyerVendorAdmin(req.params.id, req.user.username)

      order = await formatOrder(order, order.buyer === req.user.username ? true : false);

      const product = await Product.findOne({slug: order.product_slug});

      res.render('order-resume', {order, product});
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});


function verifyOrderUpdate(status, buyer, vendor, username) {
   switch (status) {
      case 'shipped':
         if (username === vendor) return
      case 'recieved':
         if (username === buyer) return
      case 'finished':
         if (username === buyer) return
      case 'rejected':
         if (username === vendor) return
      case 'not_recieved':
         if (username === buyer) return
      case 'dispute':
         if (username === buyer || username === vendor) return
   }
   throw new Error('No access');
}

function constructOrdersQuery(query, username) {
   const mongooseQuery = {};

   if (query.status) mongooseQuery.status = query.status;

   if (query.clientsOrders === 'true') mongooseQuery.vendor = username;
   else if (query.clientsOrders === 'false') mongooseQuery.buyer = username;
   else mongooseQuery.buyer = username;

   return mongooseQuery;
}

function sanitizeHtmlOfFirstMessage(orders) {
   for(let i = 0; i < orders.length; i++) {
      if (orders[i].messages[0]) orders[i].messages[0].content = sanitizeHTML(orders[i].messages[0].content);
   }
   return orders
}

router.get('/orders', Need_Authentification, sanitizeQuerys,
   async (req, res) => {
      try {
         if (![undefined, 'awaiting_info', 'awaiting_payment', 'awaiting_shipment', 'shipped', 'recieved', 'finalized', 'rejected', 'expired', 'dispute_progress', 'disputed'].includes(req.body.status)) throw new Error('Invalid type to report')
         if (![undefined, 'true'].includes(req.body.clientsOrders)) throw new Error('Invalid type to report')

         const query = constructOrdersQuery(req.query, req.user.username);

         let orders = await paginatedResults(Order, query, {page: req.query.ordersPage, limit: 24});

         orders.results = await arrayFormat_Order(orders.results, query.vendor ? false : true);

         orders.results = sanitizeHtmlOfFirstMessage(orders.results);

         res.render('your-order', {orders});
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);

router.post('/filter-orders', Need_Authentification, sanitizeQuerys,
   async (req, res) => {
      try {
         if (!['all', 'awaiting_info', 'awaiting_payment', 'awaiting_shipment', 'shipped', 'recieved', 'finalized', 'rejected', 'expired', 'dispute_progress', 'disputed'].includes(req.body.status)) throw new Error('Invalid status to filter')
         if (![undefined, 'true', 'false'].includes(req.body.clientsOrders)) throw new Error('Invalid type to filter')

         const {status, clientsOrders} = req.body;

         res.redirect(`/orders?ordersPage=1${status !== 'all' ? `&status=${status}` : ''}${clientsOrders === 'true' ? `&clientsOrders=true` : ''}`);
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);

router.post('/update-order/:id', Need_Authentification, sanitizeParamsQuerys, async (req, res) => {
   try {
      const {user} = req
      const {ordersPage, status, clientsOrders, fromOrders} = req.query

      let order = await Order.findByIdwhereYouBuyerVendor(req.params.id, user.username)

      verifyOrderUpdate(req.body.status, order.buyer, order.vendor, user.username)

      order = await HandleOrderRequest(req.body.status, order, user.settings, fromOrders);

      await order.save();

      res.redirect(fromOrders ? `/orders?ordersPage=${ordersPage ? ordersPage : '1'}${status ? `&status=${status}` : ''}${clientsOrders ? `&clientsOrders=true` : ''}` : `/order-resume/${req.params.id}`);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});


router.delete('/delete-order/:id', Need_Authentification, sanitizeParams, async (req, res) => {
   try {
      const {user} = req,
            {id} = req.params,
            {ordersPage, status, clientsOrders, fromOrders} = req.query
 
      const order = await Order.findById(id)

      if (!order) throw new Error('Invalid Params Id');
      if (!addDeleteLink(order, user.username === order.buyer ? true : false)) throw new Error('You cant delete that');

      await order.deleteOrder();

      res.redirect(fromOrders ? `/orders?ordersPage=${ordersPage ? ordersPage : '1'}${status ? `&status=${status}` : ''}${clientsOrders ? `&clientsOrders=true` : ''}` : `/orders?ordersPage=1`);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});

router.post('/create-dispute/:id', Need_Authentification, sanitizeParams, async (req, res) => {
   try {
      const order = await Order.findByIdwhereYouBuyerVendor(req.params.id, req.user.username)
      
      order.status = 'dispute_progress';
      order.timer = undefined;

      await order.save();

      res.redirect(`/order-resume/${order.id}`);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});

module.exports = router;
