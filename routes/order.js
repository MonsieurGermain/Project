const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const Order = require('../models/order');
const User = require('../models/user');
const {Need_Authentification} = require('../middlewares/authentication');
const {
   validateSlugParams,
   ValidateValueByChoice,
   Validate_ProvidedInfo,
   Validate_Update_Order,
   FetchData,
   isOrder_Buyer,
   isOrder_VendorOrBuyer,
   isOrder_Part,
   paramsUsername_isReqUsername,
   Validate_OrderCustomization,
} = require('../middlewares/validation');
const {Format_Username_Settings, paginatedResults} = require('../middlewares/function');

function Calculate_Price(base_price, qty, ship_opt_price, selection_1_price, selection_2_price) {
   let price = base_price + selection_1_price + selection_2_price; // Base Price OF Each
   price = price * qty; // Mult Qty
   price = price + ship_opt_price; // Add Shipping Price
   price += price * 0.03; // Market Fee
   price = price.toString(); // Get 2 number after .
   price = price.slice(0, price.indexOf('.') + 3);

   return parseFloat(price);
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

async function Get_Product_Img(slug) {
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

function Include_Delete_Link(order, isBuyer) {
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
         break;
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
async function Format_Order(order, isBuyer) {
   order.buyer = Format_Username_Settings(order.buyer, order.privacy);
   if (order.timer > Date.now()) order.Formated_Timers = Format_Timer(order.timer);
   order.link = Create_Order_Link(order.status, order.id, isBuyer);
   order.deletelink = Include_Delete_Link(order, isBuyer);
   order.product_img = await Get_Product_Img(order.product_slug);

   return order;
}
async function Format_Orders_Array(orders, isBuyer) {
   for (let i = 0; i < orders.length; i++) {
      orders[i] = await Format_Order(orders[i], isBuyer);
   }
   return orders;
}

// Routes
router.get('/order/:slug', Need_Authentification, validateSlugParams, async (req, res) => {
   try {
      const product = await Product.findOne({slug: req.params.slug});
      if (product.status === 'offline' && product.vendor !== req.user.username) throw new Error('Product Offline');
      // const product = await Product.findOne({slug : req.params.slug}).orFail(new Error('Invalid Slug'))
      const vendor = await User.findOne({username: product.vendor});

      res.render('order', {product, vendor});
   } catch (e) {
      console.log(e);
      res.redirect('/404');
      return;
   }
});

router.post('/create-order/:slug', Need_Authentification, Validate_OrderCustomization, async (req, res) => {
   try {
      const {product} = req;
      let {qty, shipping_option, selection_1, selection_2, type} = req.body;

      qty = qty > 1 ? qty : 1;
      if (product.qty_settings) {
         product.qty_settings.available_qty += -qty;
      }

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

      order.total_price = Calculate_Price(
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
      res.redirect('/error');
      return;
   }
});

router.get('/submit-info/:id', Need_Authentification, FetchData(['params', 'id'], Order, undefined, 'order'), isOrder_Buyer, async (req, res) => {
   try {
      const {order} = req;
      const product = await Product.findOne({slug: order.product_slug});
      const user = await User.findOne({username: order.vendor});
      res.render('submit-info', {order, product, vendor: user});
   } catch (e) {
      console.log(e);
      res.redirect('/error');
      return;
   }
});

router.post('/submit-info/:id', Need_Authentification, FetchData(['params', 'id'], Order, undefined, 'order'), isOrder_Part, Validate_ProvidedInfo, async (req, res) => {
   try {
      const {order} = req;

      let redirect_url = `/order-resume/${order.id}`;

      if (order.status === 'awaiting_info' && req.user.username === order.buyer) {
         order.status = 'awaiting_payment';
         order.timer = Date.now() + 1000 * 60 * 60;
         redirect_url = `/pay/${order.id}`;
      }

      order.messages.push({
         sender: req.user.username === order.buyer ? Format_Username_Settings(req.user.username, order.privacy) : req.user.username,
         content: req.body.content,
      });

      await order.save();

      res.redirect(redirect_url);
   } catch (e) {
      console.log(e);
      res.redirect('/error');
      return;
   }
});

router.get('/pay/:id', Need_Authentification, FetchData(['params', 'id'], Order, undefined, 'order'), isOrder_Buyer, async (req, res) => {
   try {
      const {order} = req;
      res.render('pay', {order});
   } catch (e) {
      console.log(e);
      res.redirect('/error');
      return;
   }
});

router.get('/order-resume/:id', Need_Authentification, FetchData(['params', 'id'], Order, undefined, 'order'), isOrder_Part, async (req, res) => {
   try {
      let {order} = req;
      const product = await Product.findOne({slug: order.product_slug});

      order = await Format_Order(order, order.buyer === req.user.username ? true : false);

      res.render('order-resume', {order, product});
   } catch (e) {
      console.log(e);
      res.redirect('/error');
      return;
   }
});

router.put('/update-order/:id', Need_Authentification, FetchData(['params', 'id'], Order, undefined, 'order'), isOrder_VendorOrBuyer, Validate_Update_Order, async (req, res) => {
   try {
      let {order} = req;

      order = await HandleOrderRequest(req.body.status, order, req.user.settings, req.query.fromOrders);

      await order.save();

      let redirect_url;
      if (req.query.fromOrders) redirect_url = `/orders/${req.user.username}?ordersPage=1&clientsOrders=true&status=awaiting_shipment`;
      else redirect_url = `/order-resume/${req.params.id}`;

      res.redirect(redirect_url);
   } catch (e) {
      console.log(e);
      res.redirect('/error');
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

router.get(
   '/orders/:username',
   Need_Authentification,
   paramsUsername_isReqUsername,
   ValidateValueByChoice(
      ['body', 'status'],
      [undefined, 'awaiting_info', 'awaiting_payment', 'awaiting_shipment', 'shipped', 'recieved', 'finalized', 'rejected', 'expired', 'dispute_progress', 'disputed']
   ),
   ValidateValueByChoice(['body', 'clientsOrders'], [undefined, 'true']),
   async (req, res) => {
      try {
         const query = constructOrdersQuery(req.query, req.user);

         let orders = await paginatedResults(Order, query, {page: req.query.ordersPage, limit: 24});
         orders.results = await Format_Orders_Array(orders.results, query.vendor ? false : true);

         res.render('your-order', {orders});
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);

router.post(
   '/filter-orders',
   Need_Authentification, // isAdmin,
   ValidateValueByChoice(
      ['body', 'status'],
      ['all', 'awaiting_info', 'awaiting_payment', 'awaiting_shipment', 'shipped', 'recieved', 'finalized', 'rejected', 'expired', 'dispute_progress', 'disputed']
   ),
   ValidateValueByChoice(['body', 'clientsOrders'], [undefined, 'true', 'false']),
   async (req, res) => {
      try {
         const {status, clientsOrders} = req.body;

         let query = '?ordersPage=1';

         if (status !== 'all') query += `&status=${status}`;
         if (clientsOrders === 'true') query += `&clientsOrders=true`;

         res.redirect(`/orders/${req.user.username}${query}`);
      } catch (e) {
         console.log(e);
         res.redirect('/error');
      }
   }
);

router.delete('/delete-order/:id', Need_Authentification, FetchData(['params', 'id'], Order, undefined, 'order'), isOrder_VendorOrBuyer, async (req, res) => {
   try {
      const {order} = req;

      if (!Include_Delete_Link(order, req.user.username === order.buyer ? true : false)) throw new Error('You cant delete that'); // Check if as Auth to delete

      order.deleteOrder();

      res.redirect(`/orders/${req.user.username}?ordersPage=1`);
   } catch (e) {
      console.log(e);
      res.redirect('/error');
   }
});

router.post('/create-dispute/:id', Need_Authentification, FetchData(['params', 'id'], Order, undefined, 'order'), isOrder_VendorOrBuyer, async (req, res) => {
   try {
      const {order} = req;

      order.status = 'dispute_progress';
      order.timer = undefined;

      await order.save();

      res.redirect(`/order-resume/${order.id}`);
   } catch (e) {
      console.log(e);
      res.redirect('/error');
   }
});

module.exports = router;
