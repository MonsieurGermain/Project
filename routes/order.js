const express = require('express');

const router = express.Router();
const Product = require('../models/product');
const Order = require('../models/order');
const UserModel = require('../models/user');

const { isAuth } = require('../middlewares/authentication');
const {
  sanitizeOrderCustomization,
  sanitizeParams,
  sanitizeQuerys,
  sanitizeParamsQuerys,
} = require('../middlewares/validation');
const {
  paginatedResults,
  sanitizeHTML,
} = require('../middlewares/function');

async function getUserVerifiedPgpKeys(username) {
  const vendor = await UserModel.findOne({ username }, 'verifiedPgpKeys');
  return vendor.verifiedPgpKeys;
}

// Routes
router.get('/order/:slug', isAuth, sanitizeParams, async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });

    if (product.status === 'offline' && product.vendor !== req.user.username) throw new Error('Product Offline');

    const vendor = await UserModel.findOne({ username: product.vendor });

    res.render('order', { product, vendor });
  } catch (e) {
    res.redirect('/404');
  }
});

async function getVendorMoneroAddress(vendorUsername) {
  const vendor = await UserModel.findOne({ username: vendorUsername });

  if (vendor.vendorMoneroAddress) return vendor.vendorMoneroAddress;
  throw new Error('Order rejected, because the Vendor doesnt have any monero address.');
}

router.post(
  '/create-order/:slug',
  isAuth,
  sanitizeParams,
  async (req, res, next) => {
    try {
      req.product = await Product.findOne({ slug: req.params.slug, status: 'online' }).orFail(new Error('Invalid Slug Params'));

      next();
    } catch (e) {
      res.redirect('/404');
    }
  },
  sanitizeOrderCustomization,
  async (req, res) => {
    try {
      const { product, user } = req;
      const {
        chosenShippingOption,
        chosenSelection1,
        chosenSelection2,
        privacyType,
      } = req.body;
      let { quantity } = req.body;

      if (product.qty_settings.available_qty) product.qty_settings.available_qty += -quantity;

      const order = new Order({
        buyer: user.username,
        vendor: product.vendor,
        product: product.id,
        orderMoneroAddress: product.customMoneroAddress ? product.customMoneroAddress : await getVendorMoneroAddress(product.vendor),
        orderStatus: 'awaitingInformation',
        timeUntilUpdate: Date.now() + 10800000,
        orderDetails: {
          basePrice: product.price,
          quantity,
          chosenShippingOption,
          chosenSelection1,
          chosenSelection2,
        },
        settings: {
          privacyType,
          buyerPrivateInfoDeletion: user.settings.privateInfoExpiring,
        },
      });

      order.calculateTotalOrderPrice(
        order.orderDetails.basePrice,
        order.orderDetails.quantity,
        order.orderDetails.chosenShippingOption ? order.orderDetails.chosenShippingOption.optionPrice : 0,
        order.orderDetails.chosenSelection1 ? order.orderDetails.chosenSelection1.selectedChoice.choicePrice : 0,
        order.orderDetails.chosenSelection2 ? order.orderDetails.chosenSelection2.selectedChoice.choicePrice : 0,
      );

      if (order.orderDetails.totalPrice < 1) throw new Error('Each orders need to cost at least 1$');

      await product.save();
      await order.save();

      res.redirect(`/submit-info/${order.id}`);
    } catch (e) {
      console.log(e);
      req.flash('error', e.message);
      res.redirect(`/order/${req.product.slug}`);
    }
  },
);

router.get('/submit-info/:id', isAuth, sanitizeParams, async (req, res) => {
  try {
    const { user } = req;

    const order = await Order.findById(req.params.id).populate('product');
    order.isBuyer(user.username);

    if (order.orderStatus !== 'awaitingInformation') throw Error('Invalid Order Status');

    if (order.product.message) order.product.message = sanitizeHTML(order.product.message);

    const vendorPgpKeys = await getUserVerifiedPgpKeys(order.vendor);

    res.render('submit-info', { order, product: order.product, vendorPgpKeys });
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.post('/submit-info/:id', isAuth, sanitizeParams, async (req, res) => {
  try {
    const { user } = req;
    const { content } = req.body;

    const order = await Order.findById(req.params.id);
    order.isBuyer(user.username);

    if (order.orderStatus !== 'awaitingInformation') throw Error('Invalid Order Status');

    order.addBuyerInformation(content);
    order.continueOrder(user.username);

    await order.save();

    res.redirect(`/pay/${order.id}`);
  } catch (e) {
    req.flash('error', e.message);
    res.redirect(`/submit-info/${req.params.id}`);
  }
});

router.get('/pay/:id', isAuth, sanitizeParams, async (req, res) => {
  try {
    const { user } = req;

    const order = await Order.findById(req.params.id);
    order.isBuyer(user.username);

    if (order.orderStatus !== 'awaitingPayment') throw Error('Invalid Order Status');

    res.render('pay', { order });
  } catch (e) {
    res.redirect('/404');
  }
});

router.get('/order-resume/:id', isAuth, sanitizeParams, async (req, res) => {
  try {
    const { user } = req;

    let order = await Order.findById(req.params.id).populate('product');
    order.isBuyerOrVendorOrAdmin(user.username);

    order.hasPermissionToDelete(user.username);
    order.formatTimeLeft();
    order.hideBuyerIdentity();

    res.render('order-resume', { order, product: order.product });
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.post(
  '/filter-orders',
  isAuth,
  sanitizeQuerys,
  async (req, res) => {
    try {
      const {
        status,
        clientsOrders,
      } = req.body;

      res.redirect(`/orders?ordersPage=1${status !== 'all' ? `&status=${status}` : ''}${clientsOrders === 'true' ? '&clientsOrders=true' : ''}`);
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);

function constructOrdersQuery(query, username) {
  const mongooseQuery = {};

  if (query.status) mongooseQuery.orderStatus = query.status;
  if (query.clientsOrders === 'true') mongooseQuery.vendor = username;
  else mongooseQuery.buyer = username;

  return mongooseQuery;
}

router.get(
  '/orders',
  isAuth,
  sanitizeQuerys,
  async (req, res) => {
    try {
      const { user, query } = req;

      const orders = await paginatedResults(Order, constructOrdersQuery(query, user.username), { page: query.ordersPage, limit: 24, populate: 'product' });

      for (let i = 0; i < orders.results.length; i++) {
        orders.results[i].addRedirectLink(user.username);
        orders.results[i].hasPermissionToDelete(user.username);
        orders.results[i].sanitizeBuyerInfoHtml();
        orders.results[i].formatTimeLeft();
        orders.results[i].hideBuyerIdentity();
      }

      res.render('your-order', { orders });
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);

router.post('/update-order/:id', isAuth, sanitizeParamsQuerys, async (req, res) => {
  try {
    const { user } = req;
    const {
      ordersPage,
      status,
      clientsOrders,
      fromOrders,
    } = req.query;

    let order = await Order.findById(req.params.id);

    switch (req.body.status) {
      case 'next':
        order.continueOrder(user.username);
        break;
      case 'resetTimer':
        order.resetTimer(user.username);
        break;
      case 'cancel':
        order.cancelOrder(user.username, req.body.reason);
        break;
      case 'dispute':
        order.startDispute(user.username, req.body.reason);
        break;
      case 'delete':
        order.wantDeleteOrder(user.username);
        break;
      case 'forceDelete':
        order.forceDeleteOrder(user.username);
        break;
      default:
        throw Error('Invalid Status Update');
    }

    if (req.body.status !== 'delete') await order.save();

    let redirectUrl;
    if (!fromOrders) {
      if (req.body.status === 'delete')redirectUrl = '/orders?ordersPage=1';
      else redirectUrl = `/order-resume/${req.params.id}`;
    } else redirectUrl = `/orders?ordersPage=${ordersPage || '1'}${status ? `&status=${status}` : ''}${clientsOrders ? '&clientsOrders=true' : ''}`;

    res.redirect(redirectUrl);
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.post('/update-privacy-order/:id', isAuth, sanitizeParams, async (req, res) => {
  try {
    const { user } = req;
    const { buyerPrivateInfoDeletion, privacyType } = req.body;

    if (!['never', '-1', '1', '3', '7', '30'].includes(buyerPrivateInfoDeletion)) throw new Error('Invalid Value');
    if (!['default', 'semi-hidden', 'hidden'].includes(privacyType)) throw new Error('Invalid Value');

    const order = await Order.findById(req.params.id);
    order.isBuyer(user.username);

    if (order.orderStatus === 'finalized') throw Error('Cant Change Settings Right Now');

    order.settings.privacyType = privacyType;
    order.settings.buyerPrivateInfoDeletion = buyerPrivateInfoDeletion === 'never' ? undefined : buyerPrivateInfoDeletion;

    await order.save();

    res.redirect(`/order-resume/${order.id}`);
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.post('/send-order-chat/:id', isAuth, sanitizeParams, async (req, res) => {
  try {
    const { user } = req;
    const { newChat } = req.body;

    const order = await Order.findById(req.params.id);
    order.isBuyerOrVendorOrAdmin(user.username);

    order.newChatMessage(newChat, user.username);

    await order.save();

    res.redirect(`/order-resume/${order.id}`);
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

module.exports = router;
