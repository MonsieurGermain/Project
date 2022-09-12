const mongoose = require('mongoose');
const Product = require('./product');
const Conversation = require('./conversation');
const Review = require('./review');
const {deleteImage, renameImage, isolate_mimetype} = require('../middlewares/function');

const reviewSchema = new mongoose.Schema({
   number_review: {
      type: Number,
      required: true,
   },
   total_note: {
      type: Number,
      required: true,
   },
   average_note: {
      type: Number,
      required: true,
   },
});

const settingsSchema = new mongoose.Schema({
   messageExpiring: {
      type: Number,
   },
   privateInfoExpiring: {
      type: Number,
   },
   userExpiring: { 
      type: Number
   },
   deleteEmptyConversation: {
      type: Boolean,
      required: true,
   },
   recordSeeingMessage: {
      type: Boolean,
      required: true,
   },
   currency: {
      type: String,
      required: true,
      default: 'USD',
   },
   step_verification: {
      type: String,
   },
});

const userSchema = new mongoose.Schema({
   img_path: {
      type: String,
   },
   username: {
      type: String,
      required: true,
      maxlength: 50,
      minlength: 3,
      unique: true,
   },
   password: {
      type: String,
      required: true,
   },
   authorization: {
      type: String,
      required: true,
      default: 'buyer',
   },
   awaiting_promotion: {
      type: Boolean,
   },
   email: {
      type: String,
   },
   email_verification_code: {
      type: String,
   },
   pgp_keys: {
      type: String,
   },
   verifiedPgpKeys: {
      type: String,
   },
   pgp_keys_verification_words: {
      type: String,
   },
   pgp_keys_verification_words_encrypted: {
      type: String,
   },
   settings: {
      type: settingsSchema,
      default: {messageExpiring: 7, privateInfoExpiring: 7, deleteEmptyConversation: true, recordSeeingMessage: false},
      required: true,
   },
   job: {
      type: String,
   },
   description: {
      type: String,
   },
   achievement: {
      type: Array,
   },
   languages: {
      type: Array,
   },
   saved_product: {
      type: Array,
   },
   vendorMoneroAddress: {
      type: String,
   },
   xmrRefundAddress: {
      type: String,
   },
   review: {
      type: reviewSchema,
      required: true,
      default: {number_review: 0, total_note: 0, average_note: 0},
   },
   warning: {
      type: Number,
      default: 0,
   },
   expire_at: {
      type: Number,
   },
});


userSchema.methods.UploadImg = function (file) {
   if (this.img_path) deleteImage(`./public/${this.img_path}`);
   const newImg_path = `/uploads/user-img/${this.username}${isolate_mimetype(file.mimetype, '/')}`;

   renameImage(`./public/uploads/user-img/${file.filename}`, `./public/${newImg_path}`);

   this.img_path = newImg_path;
};

userSchema.methods.updateInactiveDate = function () {
   this.expire_at = Date.now() + this.settings.userExpiring * 86400000;
};

userSchema.methods.Add_Remove_Saved_Product = function (id) {
   if (this.saved_product.includes(id)) this.saved_product = this.saved_product.filter((element) => element !== id);
   // Remove
   else this.saved_product.push(id); // Add
};

userSchema.methods.deleteUser = async function () {
   deleteImage(`./public/${this.img_path}`);

   // Delete Conversations
   const conversations = await Conversation.find({
      $or: [{sender_1: this.username}, {sender_2: this.username}],
   });

   for (let i = 0; i < conversations.length; i++) {
      conversations[i].deleteConversation();
   }

   const products = await Product.find({vendor: this.username});
   for (let i = 0; i < products.length; i++) {
      await products[i].deleteProduct();
   }

   const review = await Review.find({sender: this.username});
   for (let i = 0; i < review.length; i++) {
      await review[i].deleteReview();
   }

   await this.delete();
};

userSchema.methods.offlineAllUserProducts = async function () {
   const userProducts = await Product.find({vendor: this.username});

   for (let i = 0; i < userProducts.length; i++) {
      if (!userProducts[i].customMoneroAddress) {
         userProducts[i].status = 'offline';
         userProducts[i].save();
      }
   }
};


module.exports = mongoose.model('User', userSchema);
