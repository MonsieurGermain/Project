const {
  formatUsernameWithSettings,
  formatTimer,
  sanitizeHTML,
} = require('../../middlewares/function');

const { ORDER_STATUS } = require('../../constants/orderStatus');
const {
  BUYER_PRIVATE_INFO_DELETION,
} = require('../../constants/buyerPrivateInfoDeletion');

function applyPrivacyMeasure() {
  switch (this.settings.buyerPrivateInfoDeletion) {
    case BUYER_PRIVATE_INFO_DELETION.NEVER:
      this.timeUntilUpdate = undefined;
      break;
    case BUYER_PRIVATE_INFO_DELETION.INSTANTLY:
      this.timeUntilUpdate = undefined;
      this.deleteBuyerInformation();
      break;
    default:
      this.settings.buyerPrivateInfoDeletion = BUYER_PRIVATE_INFO_DELETION.INSTANTLY;
      this.timeUntilUpdate = this.settings.buyerPrivateInfoDeletion * 24 * 60 * 60 * 1000; // 1 days
  }
}

function calculateTimer(addedTime) {
  if (!addedTime) {
    this.timeUntilUpdate = undefined;
    return;
  }

  this.timeUntilUpdate = Date.now() + addedTime;
}

function cancelOrder(username, reason) {
  if (!reason) throw Error('You need to provide a Reason');
  if (typeof reason !== 'string') throw Error('Invalid Reason Data Type');
  if (reason.length < 10 || reason > 1000) throw Error('Invalid Reason Data Type');

  switch (this.orderStatus) {
    case ORDER_STATUS.AWAITING_SHIPMENT:
      this.isVendor(username);
      this.orderStatus = ORDER_STATUS.REJECTED;
      this.cancellationReason = reason || undefined;
      this.timeUntilUpdate = undefined;

      this.deleteBuyerInformation();
      break;
    default:
      throw Error('Cant Cancel Now');
  }
}

function continueOrder(username) {
  switch (this.orderStatus) {
    case ORDER_STATUS.AWAITING_INFORMATION:
      this.isBuyer(username);
      this.orderStatus = ORDER_STATUS.AWAITING_PAYMENT;
      this.calculateTimer(6 * 60 * 60 * 1000); // 6 hours
      break;
    case ORDER_STATUS.AWAITING_PAYMENT:
      // Escrow Make that Switch
      this.orderStatus = ORDER_STATUS.AWAITING_SHIPMENT;
      this.calculateTimer(3 * 24 * 60 * 60 * 1000); // 3 days
      break;
    case ORDER_STATUS.AWAITING_SHIPMENT:
      this.isVendor(username);
      this.orderStatus = ORDER_STATUS.SHIPPED;
      this.settings.timerResetLeft = 2;
      this.calculateTimer(7 * 24 * 60 * 60 * 1000); // 1 week
      break;
    case ORDER_STATUS.SHIPPED:
      this.isBuyer(username);
      this.orderStatus = ORDER_STATUS.RECIEVED;
      this.calculateTimer(2 * 24 * 60 * 60 * 1000); // 2 days
      break;
    case ORDER_STATUS.RECIEVED:
      this.isBuyer(username);
      this.finalizeOrder();
  }
}

function deleteBuyerInformation() {
  this.buyerInformation = undefined;
  this.settings.buyerPrivateInfoDeletion = undefined;

  // save?
}

function expiredOrder() {
  switch (this.orderStatus) {
    case ORDER_STATUS.SHIPPED:
    case ORDER_STATUS.RECIEVED:
      this.continueOrder(this.buyer);
      break;
    case ORDER_STATUS.AWAITING_INFORMATION:
    case ORDER_STATUS.AWAITING_PAYMENT:
    case ORDER_STATUS.AWAITING_SHIPMENT:
      this.orderIsExpired();
      break;
    case ORDER_STATUS.DISPUTED:
      this.applyPrivacyMeasure();
      break;
    default:
      throw Error('This Order Cannot be Expired');
  }
}

function finalize() {
  this.orderStatus = ORDER_STATUS.FINALIZED;

  this.applyPrivacyMeasure();
}

function refund() {
  // ...
}

function resetTimer() {
  if (this.orderStatus !== ORDER_STATUS.SHIPPED) throw Error('Cant Reset Now');
  if (this.settings.timerResetLeft < 1) throw Error('No more Reset');

  this.calculateTimer(7 * 24 * 60 * 60 * 1000); // 1 week
  this.settings.timerResetLeft += -1;
}

function startDispute(username, reason) {
  if (!['Product Broken', 'Product Late', 'Other'].includes(reason)) throw Error('Invalid Reason');

  switch (this.orderStatus) {
    case ORDER_STATUS.SHIPPED:
    case ORDER_STATUS.RECIEVED:
      this.isBuyer(username);
      this.orderStatus = ORDER_STATUS.DISPUTE_IN_PROGRESS;
      this.timeUntilUpdate = undefined;

      if (this.disputesSettings) this.disputesSettings.disputeReason = reason || undefined;
      else this.disputesSettings = { disputeReason: reason || undefined };
      break;
    default:
      throw Error('Cant Start a Dispute Right Now');
  }
}

function orderIsExpired() {
  this.orderStatus = ORDER_STATUS.EXPIRED;
  this.timeUntilUpdate = undefined;
  this.deleteBuyerInformation();
}

function wantDeleteOrder(username) {
  this.hasPermissionToDelete(username);

  if (this.canDelete) this.deleteOrder();
  else throw Error('Cant Start a Delete This Order Right Now');
}

function forceDeleteOrder(username) {
  switch (this.orderStatus) {
    case ORDER_STATUS.AWAITING_INFORMATION:
    case ORDER_STATUS.AWAITING_PAYMENT:
      this.deleteOrder();
      break;
    case ORDER_STATUS.AWAITING_SHIPMENT:
      this.refundOrder();
      this.deleteOrder();
      break;
    case ORDER_STATUS.SHIPPED:
    case ORDER_STATUS.RECIEVED:
    case ORDER_STATUS.FINALIZED:
      if (this.vendor === username) this.refundOrder();
      else this.finalizeOrder();
      this.deleteOrder();
      break;
    default:
      throw Error('You cant force Delete this Order');
  }
} // Rejected / Disputes Force Delete

async function deleteOrder() {
  await this.delete();
}

/// Handy Function
function hasPermissionToDelete(username) {
  switch (this.orderStatus) {
    case ORDER_STATUS.AWAITING_INFORMATION:
      if (this.buyer === username) this.canDelete = true;
      break;
    case ORDER_STATUS.FINALIZED:
      this.canDelete = true;
      break;
    case ORDER_STATUS.EXPIRED:
      this.canDelete = true;
      break;
    case ORDER_STATUS.REJECTED:
      if (this.buyer === username) this.canDelete = true;
      break;
    case ORDER_STATUS.DISPUTED:
      if (this.disputesSettings.disputeWinner === username) this.canDelete = true;
      if (!this.timeUntilUpdate || this.timeUntilUpdate < Date.now()) this.canDelete = true;
      break;
    case ORDER_STATUS.EXPIRED:
      this.canDelete = true;
      break;
  }
}

function sanitizeBuyerInfoHtml() {
  if (this.buyerInformation) this.buyerInformation = sanitizeHTML(this.buyerInformation);
}

function formatTimeLeft() {
  if (this.timeUntilUpdate > Date.now()) this.formatedTimer = formatTimer(this.timeUntilUpdate);
}

function hideBuyerIdentity() {
  this.buyer = formatUsernameWithSettings(
    this.buyer,
    this.settings.privacyType,
  );
}

function addRedirectLink(username) {
  if (this.buyer === username) {
    if (this.orderStatus === 'awaitingInformation') this.redirectLink = `/submit-info/${this.id}`;
    else if (this.orderStatus === 'awaitingPayment') this.redirectLink = `/pay/${this.id}`;
    else this.redirectLink = `/order-resume/${this.id}`;
  } else {
    this.redirectLink = `/order-resume/${this.id}`;
  }
}

function addBuyerInformation(buyerInformation) {
  if (!buyerInformation) throw Error('You need to provide the Vendor your necessary Information');
  if (typeof buyerInformation !== 'string') throw Error('Invalid Buyer Information Data Type');
  if (buyerInformation.length < 2 || buyerInformation.length > 3000) {
    throw Error(
      'Your Information need to be more then 2 and less then 3000charachters',
    );
  }

  this.buyerInformation = buyerInformation;
}

function newChatMessage(newMessage, username) {
  if (!newMessage) throw Error('You need to Provide a Message');
  if (typeof newMessage !== 'string') throw Error('Invalid Message Type');
  if (newMessage.length < 2 || newMessage.length > 3000) {
    throw Error(
      'Your message need to be more than 2 and less than 1000 characters long',
    );
  }

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
    message: newMessage,
  });
}

function addSiteFee(price) {
  const fee = price * 0.03;

  return price + fee;
}

function formatFinalPrice(price) {
  let integerPrice = parseInt(price * 100, 10);

  return integerPrice / 100;
}

function calculateTotalOrderPrice() {
  const pricePerProduct = this.orderDetails.basePrice
      + (this.orderDetails.selection1Price || 0)
      + this.orderDetails.selection2Price || 0;
  const priceWithQuantity = pricePerProduct * this.orderDetails.quantity;

  let shippingOptionPrice = 0;
  if (
    this.orderDetails.shippingOption
    && this.orderDetails.shippingOption.optionPrice
  ) {
    shippingOptionPrice = this.orderDetails.shippingOption.optionPrice;
  }

  const priceWithShippingOption = priceWithQuantity + shippingOptionPrice;
  const finalPrice = addSiteFee(priceWithShippingOption);

  this.orderDetails.totalPrice = formatFinalPrice(finalPrice);
}

/// Validation

function isBuyer(username) {
  if (this.buyer === username) return;
  throw Error('You are not the Buyer');
}

function isVendor(username) {
  if (this.vendor === username) return;
  throw Error('You are not the Vendor');
}

function isAdmin(username) {
  if (this.disputesSettings.disputeAdmin === username) return;
  throw Error('You are not the Admin');
}

function isBuyerOrVendor(username) {
  if (this.buyer === username || this.vendor === username) return;
  throw Error('You are not the Buyer nor Vendor');
}

function isBuyerOrVendorOrAdmin(username) {
  if (
    this.buyer === username
    || this.vendor === username
    || this.disputesSettings.disputeAdmin === username
  ) return;
  throw Error('You are not the Buyer nor the Vendor nor the Admin');
}

const setOrderMethodsToSchema = (orderSchema) => {
  orderSchema.methods = {
    applyPrivacyMeasure,
    calculateTimer,
    cancelOrder,
    continueOrder,
    deleteBuyerInformation,
    expiredOrder,
    finalize,
    refund,
    resetTimer,
    startDispute,
    orderIsExpired,
    wantDeleteOrder,
    forceDeleteOrder,
    deleteOrder,
    hasPermissionToDelete,
    sanitizeBuyerInfoHtml,
    formatTimeLeft,
    hideBuyerIdentity,
    addRedirectLink,
    addBuyerInformation,
    newChatMessage,
    calculateTotalOrderPrice,
    isBuyer,
    isVendor,
    isAdmin,
    isBuyerOrVendor,
    isBuyerOrVendorOrAdmin,
  };
};

module.exports = { setOrderMethodsToSchema };
