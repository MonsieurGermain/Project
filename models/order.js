const mongoose = require('mongoose');
const User = require('../models/user');

const shipping_optionSchema = new mongoose.Schema({
   option_name: {
      type: String,
   },
   option_price: {
      type: Number,
   },
});

const selection_choiceSchema = new mongoose.Schema({
   choice_name: {
      type: String,
   },
   choice_price: {
      type: Number,
   },
});

const selectionSchema = new mongoose.Schema({
   selection_name: {
      type: String,
   },
   selected_choice: selection_choiceSchema,
});

const submited_infoSchema = new mongoose.Schema({
   sender: {
      type: String,
   },
   content: {
      type: String,
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
   product_slug: {
      type: String,
      minlength: 12,
      maxlength: 507,
      required: true,
   },
   product_title: {
      type: String,
      required: true,
   },
   status: {
      type: String,
      required: true,
   },
   timer: {
      type: Number,
   },
   reset_left: {
      type: Number,
   },
   orderMoneroAddress: { 
      type: String, 
   },
   let_review: {
      type: Boolean,
   },
   qty: {
      type: Number,
      required: true,
      default: 1,
   },
   base_price: {
      type: Number,
      required: true,
   },
   total_price: {
      type: Number,
      required: true,
   },
   messages: [submited_infoSchema],

   address: {
      type: String,
      required: true,
      default: 'Basic XMR/BTC address',
   },
   shipping_option: {
      type: shipping_optionSchema,
   },
   selection_1: {
      type: selectionSchema,
   },
   selection_2: {
      type: selectionSchema,
   },
   privacy: {
      type: String,
      required: true,
   },
   admin: {
      type: String,
   },
   dispute_winner: {
      type: String,
   },
});

orderSchema.methods.Reset_Timer = function () {
   this.timer = Date.now() + 604800000;
   this.reset_left += -1;

   if (this.reset_left === 0) this.reset_left = undefined;

   return this;
};

orderSchema.methods.Apply_buyerDeleteInfo = async function (settings) {
   // Delete Provided Info
   if (settings.privateInfoExpiring === -1) {
      this.timer = undefined;
      this.submited_info = [];
   }
   else if (settings.privateInfoExpiring) this.timer = Date.now() + settings.privateInfoExpiring * 86400000; //Set timer until Auto Del
   else this.timer = undefined; //Never Delete Auto Del

   return this;
};

orderSchema.methods.Reject_Order = function () {
   this.status = 'rejected';
   this.timer = undefined;
   this.submited_info = [];
   return this;
};

orderSchema.methods.Expire_Order = function () {
   this.status = 'expired';
   this.timer = undefined;
   this.submited_info = [];
   return this;
};

orderSchema.methods.Expired_Timer = async function () {
   switch (this.status) {
      case 'awaiting_info':
         this.Expire_Order();
         break;
      case 'awaiting_payment':
         this.Expire_Order();
         break;
      case 'awaiting_shipment':
         this.Expire_Order();
         break;
      case 'shipped':
         this.status = 'recieved';
         this.timer = Date.now() + 2 * 24 * 60 * 60 * 1000;
         break;
      case 'recieved':
         this.status = 'finalized';
         this.timer = Date.now() + 2 * 24 * 60 * 60 * 1000;
         break;
      case 'finalized':
         this.timer = undefined;
         await this.Apply_buyerDeleteInfo(false);
         break;
      case 'disputed':
         this.status = 'disputed';
         await this.Apply_buyerDeleteInfo(false);
         break;
   }
};

orderSchema.methods.changeOrderProductSlug = async function (newSlug) {
   this.product_slug = newSlug;
   await this.save();
};

orderSchema.methods.handleOrderDeletion = async function () {
   // Handling Order Deletion
};

orderSchema.methods.deleteOrder = async function () {
   await this.handleOrderDeletion();
   await this.delete();
};

orderSchema.statics.findByIdwhereYouBuyer = async function(orderId, userUsername) {
   const order = await this.findById(orderId)

   if (!order) throw new Error('Invalid Id')
   if (userUsername !== order.buyer) throw new Error('You are not the Buyer of this Order')
   else return order
}

orderSchema.statics.findByIdwhereYouBuyerVendor = async function(orderId, userUsername) {
   const order = await this.findById(orderId)

   if (!order) throw new Error('Invalid Id')
   if (userUsername !== order.buyer && userUsername !== order.vendor) throw new Error('You are not the Buyer or Vendor of this Order')
   else return order
}

orderSchema.statics.findByIdwhereYouBuyerVendorAdmin = async function(orderId, userUsername) {
   const order = await this.findById(orderId)

   if (!order) throw new Error('Invalid Id')
   if (userUsername !== order.buyer && userUsername !== order.vendor && userUsername !== order.admin) throw new Error('You are not Part of this Order')
   else return order
}

module.exports = mongoose.model('Order', orderSchema);
