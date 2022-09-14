const mongoose = require('mongoose');
const slugify = require('slugify');
const User = require('./user')
const Order = require('./order');
const Review = require('./review');
const fs = require('fs');
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

const selection_choiceSchema = new mongoose.Schema({
   choice_name: {
      type: String,
   },
   choice_price: {
      type: Number,
   },
});

const selectionsSchema = new mongoose.Schema({
   selection_name: {
      type: String,
   },
   selection_choices: [selection_choiceSchema],
});

const qty_settingsSchema = new mongoose.Schema({
   available_qty: {
      type: Number,
   },
   max_order: {
      type: Number,
   },
});

// const accepted_cryptoSchema = new mongoose.Schema ({
//     xmr : {
//         type : Boolean,
//         default : true,
//     },
//     btc : {
//         type : Boolean,
//     }
// })

const shipping_option = new mongoose.Schema({
   option_description: {
      type: String,
      required: true,
   },
   option_price: {
      type: Number,
      default: 0,
      required: true,
   },
});

const productSchema = new mongoose.Schema({
   vendor: {
      type: String,
      required: true,
   },
   img_path: {
      type: String,
      required: true,
   },
   title: {
      type: String,
      required: true,
   },
   description: {
      type: String,
      required: true,
   },
   message: {
      type: String,
   },
   price: {
      type: Number,
      required: true,
      minlength: 1,
      maxlength: 15,
   },
   customMoneroAddress: { 
      type: String
   },
   currency: {
      type: String,
      required: true,
      default: 'USD',
   },
   status: {
      type: String,
      required: true,
      default: 'online',
   },
   ship_from: {
      type: String,
      required: true,
   },
   allow_hidden: {
      type: Boolean,
   },
   selection_1: {
      type: selectionsSchema,
   },
   selection_2: {
      type: selectionsSchema,
   },
   details: {
      type: Array,
   },
   salesPrice: {
      type: Number,
   },
   salesDuration: {
      type: Number,
   },
   sales_end: {
      type: Number,
   },
   shipping_option: [shipping_option],

   qty_settings: {
      type : qty_settingsSchema
   },
   review: {
      type: reviewSchema,
      required: true,
      default: {number_review: 0, total_note: 0, average_note: 0},
   },
   slug: {
      type: String,
      required: true,
      unique: true,
   },
});

// productSchema.index({title:'text'})

// Image Path
productSchema.methods.UploadImg = function (filename, Old_Image) {
   if (Old_Image) deleteImage(`./public/${this.img_path}`); //

   const newImg_path = `/uploads/product-img/${this.slug}${isolate_mimetype(filename, '.')}`;

   renameImage(`./public/uploads/product-img/${filename}`, `./public/${newImg_path}`);

   this.img_path = newImg_path;
};

// Function
function Create_Slug(title, vendor) {
   return slugify(title, {lower: true, strict: true}) + '-' + vendor;
}

// Methods
productSchema.methods.createSlug = function (title, vendor) {
   this.slug = Create_Slug(title, vendor);
};

productSchema.methods.changeSlug = async function (title, vendor) {
   const oldSlug = this.slug;
   const newSlug = Create_Slug(title, vendor);

   const orders = await Order.find({product_slug: oldSlug});
   for (let i = 0; i < orders.length; i++) {
      await orders[i].changeOrderProductSlug(newSlug);
   }

   const reviews = await Review.find({product_slug: oldSlug});
   for (let i = 0; i < reviews.length; i++) {
      await reviews[i].changeReviewProductSlug(newSlug);
   }

   this.slug = newSlug;

   const newImage_path = `/uploads/product-img/${this.slug}${isolate_mimetype(this.img_path, '.')}`;

   renameImage(`./public/${this.img_path}`, `./public/${newImage_path}`);

   this.img_path = newImage_path;
};

productSchema.methods.deleteProduct = async function () {
   // Product Img 
   deleteImage(`./public/${this.img_path}`);

   // Saved Product
   // const usersWithSAvedProdcut = await User.find({'saved_product': {$in : this.slug}})

   // for(let i = 0; i < usersWithSAvedProdcut.length; i++) {
   //    const indexOfProduct = usersWithSAvedProdcut[i].saved_product.map((elem) => elem).indexOf(this.slug)

   //    usersWithSAvedProdcut[i].saved_product.splice(indexOfProduct, 1)

   //    usersWithSAvedProdcut[i].save()
   // }

   // Order
   const orders = await Order.find({product_slug: this.slug});
   for (let i = 0; i < orders.length; i++) {
      await orders[i].deleteOrder();
   }

   // Review
   const reviews = await Review.find({product_slug: this.slug});
   for (let i = 0; i < reviews.length; i++) {
      await reviews[i].deleteReview();
   }

   await this.delete();
};

productSchema.methods.endSales = function () {
   this.salesPrice = undefined;
   this.salesDuration = undefined;
   this.sales_end = undefined;
};

productSchema.methods.startSales = function (salesPrice, salesDuration) {
   this.salesPrice = salesPrice;
   this.salesDuration = salesDuration;
   this.sales_end = Date.now() + 86400000 * salesDuration;
};


productSchema.statics.findOneOrCreateNew = async function(productSlug, productVendor) {
   const product = await this.findOne({slug: productSlug, vendor: productVendor})

   if (product) return product
   else return new this()
}

module.exports = mongoose.model('Product', productSchema);
