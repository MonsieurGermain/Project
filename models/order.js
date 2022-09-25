const mongoose = require('mongoose');
const { formatUsernameWithSettings, formatTimer, sanitizeHTML } = require('../middlewares/function');

const shippingOptionSchema = new mongoose.Schema({
  optionName: {
    type: String,
  },
  optionPrice: {
    type: Number,
  },
});

const selectioncChoiceSchema = new mongoose.Schema({
  choiceName: {
    type: String,
  },
  choicePrice: {
    type: Number,
  },
});

const selectionSchema = new mongoose.Schema({
  selectionName: {
    type: String,
  },
  selectedChoice: selectioncChoiceSchema,
});

const orderChatSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
});

const disputesSettingsSchema = new mongoose.Schema({
  disputeAdmin: {
    type: String,
  },
  disputeWinner: {
    type: String,
  },
  disputeReason: {
    type: String,
  },
});

const settingsSchema = new mongoose.Schema({
  leftReview: {
    type: Boolean,
  },
  timerResetLeft: {
    type: Number,
  },
  buyerPrivateInfoDeletion: {
    type: Number,
  },
  privacyType: {
    type: String,
  },
});

const orderDetailsSchema = new mongoose.Schema({
  basePrice: {
    type: Number,
    required: true,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  chosenShippingOption: {
    type: shippingOptionSchema,
  },
  chosenSelection1: {
    type: selectionSchema,
  },
  chosenSelection2: {
    type: selectionSchema,
  },
});

const orderSchema = new mongoose.Schema({
  buyer: {
    type: String,
    required: true,
  },
  vendor: {
    type: String,
    required: true,
  },
  product: {
    type: mongoose.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  buyerInformation: {
    type: String,
  },
  orderStatus: {
    type: String,
    required: true,
  },
  timeUntilUpdate: {
    type: Number,
  },
  orderMoneroAddress: {
    type: String,
    required: true,
  },
  cancellationReason: {
    type: String,
  },
  orderDetails: {
    type: orderDetailsSchema,
  },
  settings: {
    type: settingsSchema,
  },
  disputesSettings: {
    type: disputesSettingsSchema,
  },
  orderChat: [orderChatSchema],
});

// Updating Status Function
orderSchema.methods.calculateTimer = function (addedTime) {
  if (!addedTime) this.timeUntilUpdate = undefined;
  else this.timeUntilUpdate = Date.now() + addedTime;
};

orderSchema.methods.refundOrder = function () {
  // Refund Order
};

orderSchema.methods.finalizeOrder = function () {
  // Pay Vendor
  this.orderStatus = 'finalized';

  this.applyPrivacyMeasure();
};

orderSchema.methods.deleteBuyerInformation = function () {
  this.buyerInformation = undefined;
  this.settings.buyerPrivateInfoDeletion = undefined;
};

orderSchema.methods.applyPrivacyMeasure = function () {
  switch (this.settings.buyerPrivateInfoDeletion) {
    case undefined:
      this.timeUntilUpdate = undefined;
      break;
    case -1:
      this.timeUntilUpdate = undefined;
      this.deleteBuyerInformation();
      break;
    default:
      this.settings.buyerPrivateInfoDeletion = -1;
      this.timeUntilUpdate = this.settings.buyerPrivateInfoDeletion * 86400000; // 1 days
  }
};

orderSchema.methods.continueOrder = function (username) {
  switch (this.orderStatus) {
    case 'awaitingInformation':
      this.isBuyer(username);
      this.orderStatus = 'awaitingPayment';
      this.calculateTimer(21600000); // 6 hours
      break;
    case 'awaitingPayment':
      // Escrow Make that Switch
      this.orderStatus = 'awaitingShipping';
      this.calculateTimer(259200000); // 3 days
      break;
    case 'awaitingShipping':
      this.isVendor(username);
      this.orderStatus = 'shipped';
      this.settings.timerResetLeft = 2;
      this.calculateTimer(604800000); // 1 week
      break;
    case 'shipped':
      this.isBuyer(username);
      this.orderStatus = 'recieved';
      this.calculateTimer(172800000); // 2 days
      break;
    case 'recieved':
      this.isBuyer(username);
      this.finalizeOrder();
  }
};

orderSchema.methods.resetTimer = function () {
  if (this.orderStatus !== 'shipped') throw Error('Cant Reset Now');
  if (this.settings.timerResetLeft < 1) throw Error('No more Reset');

  this.calculateTimer(604800000);
  this.settings.timerResetLeft += -1;
};

orderSchema.methods.cancelOrder = async function (username, reason) {
  if (!reason) throw Error('You need to provide a Reason');
  if (typeof (reason) !== 'string') throw Error('Invalid Reason Data Type');
  if (reason.length < 10 || reason > 1000) throw Error('Invalid Reason Data Type');

  switch (this.orderStatus) {
    case 'awaitingShipping':
      this.isVendor(username);
      this.orderStatus = 'rejected';
      this.cancellationReason = reason || undefined;
      this.timeUntilUpdate = undefined;

      this.deleteBuyerInformation();
      break;
    default:
      throw Error('Cant Cancel Now');
  }
};

orderSchema.methods.startDispute = async function (username, reason) {
  if (!['Product Broken', 'Product Late', 'Other'].includes(reason)) throw Error('Invalid Reason');

  switch (this.orderStatus) {
    case 'shipped':
    case 'recieved':
      this.isBuyer(username);
      this.orderStatus = 'disputeInProgress';
      this.timeUntilUpdate = undefined;

      if (this.disputesSettings) this.disputesSettings.disputeReason = reason || undefined;
      else this.disputesSettings = { disputeReason: reason || undefined };
      break;
    default:
      throw Error('Cant Start a Dispute Right Now');
  }
};

orderSchema.methods.orderIsExpired = function () {
  this.orderStatus = 'expired';
  this.timeUntilUpdate = undefined;
  this.deleteBuyerInformation();
};

orderSchema.methods.expiredOrder = function () {
  switch (this.orderStatus) {
    case 'shipped':
    case 'recieved':
      this.continueOrder(this.buyer);
      break;
    case 'awaitingInformation':
    case 'awaitingPayment':
    case 'awaitingShipping':
      this.orderIsExpired();
      break;
    case 'disputed':
      this.applyPrivacyMeasure();
      break;
    default:
      throw Error('This Order Cannot be Expired');
  }
};

orderSchema.methods.wantDeleteOrder = function (username) {
  this.hasPermissionToDelete(username);

  if (this.canDelete) this.deleteOrder();
  else throw Error('Cant Start a Delete This Order Right Now');
};

orderSchema.methods.forceDeleteOrder = function (username) {
  switch (this.orderStatus) {
    case 'awaitingInformation':
    case 'awaitingPayment':
      this.deleteOrder();
      break;
    case 'awaitingShipment':
      this.refundOrder();
      this.deleteOrder();
      break;
    case 'shipped':
    case 'recieved':
    case 'finalized':
      if (this.vendor === username) this.refundOrder();
      else this.finalizeOrder();
      this.deleteOrder();
      break;
    default:
      throw Error('You cant force Delete this Order');
  }
}; // Rejected / Disputes Force Delete

orderSchema.methods.deleteOrder = async function () {
  await this.delete();
};

/// Handy Function
orderSchema.methods.hasPermissionToDelete = function (username) {
  switch (this.orderStatus) {
    case 'awaitingInformation':
      if (this.buyer === username) this.canDelete = true;
      break;
    case 'finalized':
      this.canDelete = true;
      break;
    case 'expired':
      this.canDelete = true;
      break;
    case 'rejected':
      if (this.buyer === username) this.canDelete = true;
      break;
    case 'disputed':
      if (this.disputesSettings.disputeWinner === username) this.canDelete = true;
      if (!this.timeUntilUpdate || this.timeUntilUpdate < Date.now()) this.canDelete = true;
      break;
    case 'expired':
      this.canDelete = true;
      break;
  }
};

orderSchema.methods.sanitizeBuyerInfoHtml = function () {
  if (this.buyerInformation) this.buyerInformation = sanitizeHTML(this.buyerInformation);
};

orderSchema.methods.formatTimeLeft = function () {
  if (this.timeUntilUpdate > Date.now()) this.formatedTimer = formatTimer(this.timeUntilUpdate);
};

orderSchema.methods.hideBuyerIdentity = function () {
  this.buyer = formatUsernameWithSettings(this.buyer, this.settings.privacyType);
};

orderSchema.methods.addRedirectLink = function (username) {
  if (this.buyer === username) {
    if (this.orderStatus === 'awaitingInformation') this.redirectLink = `/submit-info/${this.id}`;
    else if (this.orderStatus === 'awaitingPayment') this.redirectLink = `/pay/${this.id}`;
    else this.redirectLink = `/order-resume/${this.id}`;
  } else {
    this.redirectLink = `/order-resume/${this.id}`;
  }
};

orderSchema.methods.addBuyerInformation = function (buyerInformation) {
  if (!buyerInformation) throw Error('You need to provide the Vendor your necessary Information');
  if (typeof (buyerInformation) !== 'string') throw Error('Invalid Buyer Information Data Type');
  if (buyerInformation.length < 2 || buyerInformation.length > 3000) throw Error('Your Information need to be more then 2 and less then 3000charachters');

  this.buyerInformation = buyerInformation;
};

orderSchema.methods.newChatMessage = function (newChatMessage, username) {
  if (!newChatMessage) throw Error('You need to Provide a Message');
  if (typeof (newChatMessage) !== 'string') throw Error('Invalid Message Type');
  if (newChatMessage.length < 2 || newChatMessage.length > 3000) throw Error('Your message need to be more than 2 and less than 1000 characters long');

  let sender;
  switch (username) {
    case this.buyer:
      sender = 'buyer';
      break;
    case this.vendor:
      sender = 'vendor';
      break;
    case this.disputesSettings.disputeAdmin:
      sender = 'admin';
      break;
    default:
      throw Error('Forbidden');
  }

  this.orderChat.push({
    sender,
    message: newChatMessage,
  });
};

/// Price Calculation

function addSiteFee(price) {
  const fee = price * 0.03;

  return price + fee;
}

function formatFinalPrice(price) {
  const stringedPrice = price.toString();

  const keepPriceCents = stringedPrice.slice(0, stringedPrice.indexOf('.') + 3);

  return parseFloat(keepPriceCents);
}

orderSchema.methods.calculateTotalOrderPrice = function (basePrice, quantity, shippingOptionPrice, selection1Price, selection2Price) {
  const pricePerProduct = basePrice + selection1Price + selection2Price;

  const priceWithQuantity = pricePerProduct * quantity;

  const priceWithShippingOption = priceWithQuantity + shippingOptionPrice;

  const finalPrice = addSiteFee(priceWithShippingOption); // Here you can play with the Transaction Fee

  this.orderDetails.totalPrice = formatFinalPrice(finalPrice); // Should We delete That ?
};

/// Validation

orderSchema.methods.isBuyer = function (username) {
  if (this.buyer === username) return;
  throw Error('You are not the Buyer');
};

orderSchema.methods.isVendor = function (username) {
  if (this.vendor === username) return;
  throw Error('You are not the Vendor');
};

orderSchema.methods.isAdmin = function (username) {
  if (this.disputesSettings.disputeAdmin === username) return;
  throw Error('You are not the Admin');
};

orderSchema.methods.isBuyerOrVendor = function (username) {
  if (this.buyer === username || this.vendor === username) return;
  throw Error('You are not the Buyer nor Vendor');
};

orderSchema.methods.isBuyerOrVendorOrAdmin = function (username) {
  if (this.buyer === username || this.vendor === username || this.disputesSettings.disputeAdmin === username) return;
  throw Error('You are not the Buyer nor the Vendor nor the Admin');
};

module.exports = mongoose.model('Order', orderSchema);
