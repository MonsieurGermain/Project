const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const Order = require('../models/order');
const User = require('../models/user');
const {Need_Authentification} = require('../middlewares/authentication');
const {
   paramsUsername_isReqUsername,
   Validate_OrderCustomization,
} = require('../middlewares/validation');
const {formatUsernameWithSettings, paginatedResults} = require('../middlewares/function');


function validateData(value, acceptedValues) {
   for (let i = 0; i < acceptedValues.length; i++) {
      if (acceptedValues[i] === value) return true;
   }
   return;
}

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
function Get_Int_In_Number(number, Timer, Time_Left, Time_Amount) {
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

   [Timer, Time_Left] = Get_Int_In_Number(86400000, Timer, Time_Left, 'Days');
   [Timer, Time_Left] = Get_Int_In_Number(3600000, Timer, Time_Left, 'Hours');
   [Timer, Time_Left] = Get_Int_In_Number(60000, Timer, Time_Left, 'Mins');
   [Timer, Time_Left] = Get_Int_In_Number(1000, Timer, Time_Left, 'Secs');

   return Time_Left;
}

async function getProductImg(slug) {
   const product = await Product.findOne({slug: slug});
   return product.img_path;
}

function Create_Order_Link(status, id, isBuyer) {
   if (isBuyer) {
      switch (status) {
         case 'awaiting_info':
            return `/submit-info/${id}`;
         case 'awaiting_payment':
            return `/pay/${id}`;
      }
   }
   return `/order-resume/${id}`;
}

function addDeleteLink(order, isBuyer) {
   switch (order.status) {
      case 'rejected':
         if (isBuyer) return true;
         else return;
      case 'finalized':
         return true;
      case 'expired':
         return true;
      case 'awaiting_info':
         if (isBuyer) return true;
         else return;
      case 'disputed':
         if (order.dispute_winner !== order.vendor) {
            if (isBuyer) return true;
         } else if (!order.timer) return true;
         break;
      default:
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
router.get('/order/:slug', Need_Authentification, async (req, res) => {
   try {
      const product = await Product.findOne({slug: req.params.slug});

      if (product.status === 'offline' && product.vendor !== req.user.username) throw new Error('Product Offline');
      
      const vendor = await User.findOne({username: product.vendor});

      res.render('order', {product, vendor});
   } catch (e) {
      res.redirect('/404');
   }
});

router.post('/create-order/:slug', Need_Authentification, Validate_OrderCustomization, async (req, res) => {
   try {
      const {product} = req;
      let {qty, shipping_option, selection_1, selection_2, type} = req.body;

      qty = qty > 1 ? qty : 1;
      if (product.qty_settings) product.qty_settings.available_qty += -qty;

      const order = new Order({
         buyer: req.user.username,
         vendor: product.vendor,
         product_title: product.title,
         product_slug: product.slug,
         base_price: product.price,
         total_price: product.price,
         qty: qty,
         shipping_option: shipping_option,
         selection_1: selection_1,
         selection_2: selection_2,
         status: 'awaiting_info',
         timer: Date.now() + 30 * 60 * 1000, // 30min
         privacy: type,
      });

      order.total_price = calculateOrderPrice(
         order.base_price,
         order.qty,
         order.shipping_option ? order.shipping_option.option_price : 0,
         order.selection_1 ? order.selection_1.selected_choice.choice_price : 0,
         order.selection_2 ? order.selection_2.selected_choice.choice_price : 0
      );

      await product.save();
      await order.save();

      res.redirect(`/submit-info/${order.id}`);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});

router.get('/submit-info/:id', Need_Authentification, async (req, res) => {
   try {
      const order = await Order.findByIdwhereYouBuyer(req.params.id, req.user.username)

      const product = await Product.findOne({slug: order.product_slug});
      const user = await User.findOne({username: order.vendor});

      res.render('submit-info', {order, product, vendor: user});
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});

router.post('/submit-info/:id', Need_Authentification, async (req, res) => {
   try {
      const {user} = req
      const {content} = req.body
      
      if (!content || content < 2 || content > 3000) throw new Error('Invalid Submited Information')

      const order = await Order.findByIdwhereYouBuyerVendorAdmin(req.params.id, req.user.username)

      order.messages.push({
         sender: user.username === order.buyer ? formatUsernameWithSettings(user.username, order.privacy) : user.username,
         content: content
      });

      if (order.status === 'awaiting_info' && user.username === order.buyer) {
         order.status = 'awaiting_payment';
         order.timer = Date.now() + 1000 * 60 * 60;
         redirect_url = `/pay/${order.id}`;
      } else {
         redirect_url = `/order-resume/${order.id}`;
      }

      await order.save();

      res.redirect(redirect_url);
   } catch (e) {
      req.flash('error', e.messages)
      res.redirect('/404');
   }
});

router.get('/pay/:id', Need_Authentification, async (req, res) => {
   try {
      const order = await Order.findByIdwhereYouBuyer(req.params.id, req.user.username)

      res.render('pay', {order});
   } catch (e) {
      res.redirect('/404');
   }
});

router.get('/order-resume/:id', Need_Authentification, async (req, res) => {
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
         else throw new Error('No access');
      case 'recieved':
         if (username === buyer) return
         else throw new Error('No access');
      case 'finished':
         if (username === buyer) return
         else throw new Error('No access');
      case 'rejected':
         if (username === vendor) return
         else throw new Error('No access');
      case 'not_recieved':
         if (username === buyer) return
         else throw new Error('No access');
      case 'dispute':
         if (username === buyer || username === vendor) return
         else throw new Error('No access');
      default:
         throw new Error('Update Value Invalid');
   }
}


router.put('/update-order/:id', Need_Authentification, async (req, res) => {
   try {
      const {user} = req

      let order = await Order.findByIdwhereYouBuyerVendor(req.params.id, user.username)

      verifyOrderUpdate(req.body.status, order.buyer, order.vendor, user.username)

      order = await HandleOrderRequest(req.body.status, order, user.settings, req.query.fromOrders);

      await order.save();

      let redirect_url;
      if (req.query.fromOrders) {
         console.log(req.query)
         if (req.query.status) redirect_url = `/orders/${user.username}?ordersPage=${req.query.ordersPage}&clientsOrders=true&status=${req.query.status}`;
         else redirect_url = `/orders/${user.username}?clientsOrders=true&ordersPage=${req.query.ordersPage}`
      }
      else redirect_url = `/order-resume/${req.params.id}`;

      res.redirect(redirect_url);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});

function constructOrdersQuery(query, user) {
   const mongooseQuery = {};

   if (query.status) mongooseQuery.status = query.status;

   if (query.clientsOrders === 'true') mongooseQuery.vendor = user.username;
   else if (query.clientsOrders === 'false') mongooseQuery.buyer = user.username;
   else mongooseQuery.buyer = user.username;

   return mongooseQuery;
}

router.get('/orders/:username', Need_Authentification, paramsUsername_isReqUsername,
   async (req, res) => {
      try {
         if (!validateData(req.body.status, [undefined, 'awaiting_info', 'awaiting_payment', 'awaiting_shipment', 'shipped', 'recieved', 'finalized', 'rejected', 'expired', 'dispute_progress', 'disputed'])) throw new Error('Invalid type to report')
         if (!validateData(req.body.clientsOrders, [undefined, 'true'])) throw new Error('Invalid type to report')

         const query = constructOrdersQuery(req.query, req.user);

         let orders = await paginatedResults(Order, query, {page: req.query.ordersPage, limit: 24});

         orders.results = await arrayFormat_Order(orders.results, query.vendor ? false : true);

         res.render('your-order', {orders});
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);

router.post('/filter-orders', Need_Authentification,
   async (req, res) => {
      try {
         if (!validateData(req.body.status, ['all', 'awaiting_info', 'awaiting_payment', 'awaiting_shipment', 'shipped', 'recieved', 'finalized', 'rejected', 'expired', 'dispute_progress', 'disputed'])) throw new Error('Invalid type to report')
         if (!validateData(req.body.clientsOrders, ['body', 'clientsOrders'])) throw new Error('Invalid type to report')

         const {status, clientsOrders} = req.body;

         let query = '?ordersPage=1';

         if (status !== 'all') query += `&status=${status}`;
         if (clientsOrders === 'true') query += `&clientsOrders=true`;

         res.redirect(`/orders/${req.user.username}${query}`);
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);

router.delete('/delete-order/:id', Need_Authentification, async (req, res) => {
   try {
      const order = await Order.findByIdwhereYouBuyerVendor(req.params.id, req.user.username)

      if (!addDeleteLink(order, req.user.username === order.buyer ? true : false)) throw new Error('You cant delete that');

      await order.deleteOrder();

      res.redirect(`/orders/${req.user.username}?ordersPage=1`);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});

router.post('/create-dispute/:id', Need_Authentification, async (req, res) => {
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
