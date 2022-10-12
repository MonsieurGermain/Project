const Conversation = require('../models/conversation');
const Order = require('../models/order');
const User = require('../models/user');
const Product = require('../models/product');

async function deleteExpiredMessage() {
  const dateNow = Date.now();
  const converstionWithExpiredMessage = await Conversation.find({ 'messages.expireAt': { $lt: dateNow } });

  for (let i = 0; i < converstionWithExpiredMessage.length; i++) {
    converstionWithExpiredMessage[i].deleteExpiredMessage(dateNow);
    converstionWithExpiredMessage[i].emptyMessage();
  }
}

async function hasOrderBeenPaid() {
  const orders = await Order.find({ orderStatus: 'awaitingPayment' });

  for (let i = 0; i < orders.length; i++) {
    orders[i].continueOrder();
    orders[i].save();
  }
}

async function deleteExpiredConversation() {
  const dateNow = Date.now();
  const expiredConversation = await Conversation.find({ 'settings.convoExpiryDate': { $lt: dateNow } });

  for (let i = 0; i < expiredConversation.length; i++) {
    expiredConversation[i].deleteConversation();
  }
}

// Refund if paid
async function handleOrderWithExpiredTimer() {
  const orders = await Order.find({ timeUntilUpdate: { $lt: Date.now() } });

  for (let i = 0; i < orders.length; i++) {
    if (orders[i].orderStatus !== 'finalized') orders[i].expiredOrder();
    else orders[i].applyPrivacyMeasure();

    orders[i].save();
  }
}

async function deleteInactiveUser() {
  const users = await User.find({ expire_at: { $lt: Date.now() } });

  for (let i = 0; i < users.length; i++) {
    users[i].deleteUser();
  }
}

async function findAndendSales() {
  const products = await Product.find({ sales_end: { $lt: Date.now() } });

  for (let i = 0; i < products.length; i++) {
    products[i].endSales();
    products[i].save();
  }
}

function allDatabaseScanningFunction() {
  setInterval(() => {
    console.log('1min');
    deleteExpiredMessage();
    hasOrderBeenPaid();
  }, 60000); // 1 min

  setInterval(() => {
    console.log('5min');
    handleOrderWithExpiredTimer();
    findAndendSales();
  }, 300000); // 5min

  setInterval(() => {
    console.log('1day');
    deleteExpiredConversation();
    deleteInactiveUser();
  }, 86400000); // 1day
}

module.exports = { allDatabaseScanningFunction };
