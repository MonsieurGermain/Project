/* eslint-disable no-await-in-loop */

const Conversation = require('../models/conversation');
const { OrderModel } = require('../models/order');
const User = require('../models/user');
const Product = require('../models/product');
const { ORDER_STATUS } = require('../constants/orderStatus');

async function deleteExpiredMessage() {
  const date = Date.now();
  const conversationWithOldMessages = await Conversation.find({
    'messages.expire_at': { $lt: date },
  });

  for (let i = 0; i < conversationWithOldMessages.length; i++) {
    conversationWithOldMessages[i].deleteMessageWithDate(date);

    if (!conversationWithOldMessages[i].messages.length) {
      const sender1 = await User.findOne({
        username: conversationWithOldMessages[i].sender_1,
      });

      if (!sender1 || sender1.settings.deleteEmptyConversation) {
        conversationWithOldMessages[i].deleteConversation();
      } else conversationWithOldMessages[i].save();
    } else {
      conversationWithOldMessages[i].save();
    }
  }
}

async function hasOrderBeenPaid() {
  const orders = await OrderModel.find({
    orderStatus: ORDER_STATUS.AWAITING_PAYMENT,
  });

  for (let i = 0; i < orders.length; i++) {
    orders[i].checkPaid();
  }
}

// Refund if paid
async function handleOrderWithExpiredTimer() {
  const orders = await OrderModel.find({
    timeUntilUpdate: { $lt: Date.now() },
  });

  for (let i = 0; i < orders.length; i++) {
    if (orders[i].orderStatus !== ORDER_STATUS.FINALIZED) orders[i].expiredOrder();
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

// try to release failed escrow release (due to locked balance)
async function retryEscrowRelease() {
  //
}

function allDatabaseScanningFunction() {
  setInterval(() => {
    console.log('5min');
    deleteExpiredMessage();
    handleOrderWithExpiredTimer();
    findAndendSales();
  }, 5 * 60 * 1000); // 5min

  // increased payment check time to 1h since payment check will be done by webhook
  // this is to prevent the case where the webhook is not called
  setInterval(() => {
    console.log('1h');
    hasOrderBeenPaid();
    retryEscrowRelease();
  }, 60 * 60 * 1000); // 1h

  setInterval(() => {
    console.log('1day');
    deleteInactiveUser();
  }, 24 * 60 * 60 * 1000); // 1day
}

module.exports = { allDatabaseScanningFunction };
