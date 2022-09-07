const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const Review = require('../models/review');
const User = require('../models/user');
const {Need_Authentification, isVendor} = require('../middlewares/authentication');
const {Validate_Product} = require('../middlewares/validation');
const {uploadProductImg, deleteImage, sanitizeHTML, paginatedResults} = require('../middlewares/function');

const Fuse = require('fuse.js');
// Create Fuzzy Product Collecion
var fusedProduct = Product.find({status: 'online'}).then((products) => {
   const options = {
      threshold: 0.5,
      keys: ['title', 'vendor'],
   };
   fusedProduct = new Fuse(products, options);
});
// Update Fuzzy Product Collecion
setInterval(() => {
   Product.find({status: 'online'}).then((products) => {
      const options = {
         threshold: 0.4,
         keys: ['title', 'vendor'],
      };
      fusedProduct = new Fuse(products, options);
   });
}, 300000); // 5min 300000

// Dont Get Local Product
router.get('/products', async (req, res) => {
   try {
      let paginatedProducts, productsFuzzy;

      const {search, productPage} = req.query

      if (search) {
         const productFused = fusedProduct.search(search);
         productsFuzzy = productFused.map(({item}) => item);
      }
      paginatedProducts = await paginatedResults(Product, {status: 'online'}, {page: productPage, limit: 24}, productsFuzzy);

      res.render('products', {paginatedProducts});
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});

router.post('/search-products', async (req, res) => {
   const {search} = req.body
   if (search.length > 100) search = search.split(0, 100)
   res.redirect(`/products?search=${req.body.search}&productPage=1`);
});

router.get('/product/:slug', async (req, res) => {
   try {
      const product = await Product.findOne({slug: req.params.slug});

      if (product.status === 'offline' && product.vendor !== req.user.username) throw new Error('Product Offline');
      
      const vendor = await User.findOne({username: product.vendor});

      const paginatedReviews = await paginatedResults(Review, {product_slug: product.slug}, {page: req.query.reviewPage});

      product.description = sanitizeHTML(product.description);

      res.render('product-single', {product, vendor, paginatedReviews});
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});

// GET
router.get('/create-product', Need_Authentification, isVendor,
   async (req, res) => {
      try { 

         const product = await Product.findOneOrCreateNew(req.query.slug, req.user.username)

         const reviews = [
            {
               sender: 'Dummy Username',
               content: 'Wow This Product was Amazing !',
               type: 'default',
               note: 5,
               __v: 0,
            },
            {
               sender: 'Dummy Username',
               content: 'The shipping was a bit slow, but the product itself is really cool.',
               type: 'default',
               note: 4,
               __v: 0,
            },
            {
               sender: 'Dummy Username',
               content: 'Will definetly buy again',
               type: 'default',
               note: 5,
               __v: 0,
            },
            {
               sender: 'Dummy Username',
               content: 'The Product arrived broken :(, luckely, the vendor was kind enough to send me another one',
               type: 'default',
               note: 4,
               __v: 0,
            },
            {
               sender: 'Dummy Username',
               content: 'Great I like it !',
               type: 'default',
               note: 5,
               __v: 0,
            },
         ];
   
         res.render('product-create', {product, reviews});
      } catch (e) {
         console.log(e)
         res.redirect('/404')
      }
   }
);

//POST
router.post('/create-product', Need_Authentification, uploadProductImg.single('productImage'), 
async(req,res, next) => {
   try { 
      const product = await Product.findOneOrCreateNew(req.query.slug, req.user.username)

      req.product = product ? product : new Product();

      next()
   } catch (e) {
      res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`)
   }
},
Validate_Product, async (req, res) => {
   try {
      const {
         title,
         description,
         message,
         price,
         ship_from,
         allow_hidden,
         qty_settings,
         shipping_option,
         selection_1,
         selection_2,
         details,
         salesPrice,
         salesDuration,
         stop_sales,
         status,
      } = req.body;

      const {product} = req

      if (product.title !== title) {
         const isProductTitleTaken = await Product.findOne({title: title, vendor: req.user.username})
         if (isProductTitleTaken) throw new Error('You cant have the same title for multiple products')
      }

      let success_message = product.title ? 'Product Successfully Edited' : 'Product Successfully Created';

      // Title and Slug
      if (!product.title) product.createSlug(title, req.user.username); // Create Slug if Creating New Product
      if (product.title && product.title !== title) await product.changeSlug(title, product.vendor); // If Editing Product and Change Title, Change Slugs

      // Img Path
      if (!product.img_path && !req.file) throw new Error('You need to uploads an Image for your new Product'); // If Create New Prod and Submit No Img
      else if (!product.img_path) await product.UploadImg(req.file.filename); // If Create New Product, Upload Img
      else if (product.img_path && req.file) await product.UploadImg(req.file.filename, true); // If Edit Product and Send New Img, Del Old One & Upload Img

      // price
      if (stop_sales) {
         product.endSales();
      } else if (!product.title) {
         product.price = price;
      } else {
         if (!product.originalPrice && salesPrice) {
            product.startSales(price, salesPrice, salesDuration);
         } else {
            product.price = price;
         }
      }

      product.title = title;
      product.vendor = req.user.username;
      product.description = description;
      product.message = message;
      product.ship_from = ship_from;
      product.allow_hidden = allow_hidden;
      product.selection_1 = selection_1;
      product.selection_2 = selection_2;
      product.details = details;
      product.shipping_option = shipping_option;
      product.qty_settings = qty_settings;
      product.status = req.user.xmr_address ? status : 'offline';

      await product.save();

      if (!req.user.xmr_address && status === 'online') {
         req.flash('warning', 'You need to add a Monero Address to your account to be able to put a product online, we have change the state of your product to offline');
         res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`);
      } else {
         req.flash('success', success_message);
         res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`);
      }
   } catch (e) {
      console.log(e);
      if (req.file) {
         deleteImage(req.file.path);
      }
      req.flash('error', e.message)
      res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`);
   }
});

//Delete
router.delete('/delete-product/:slug', Need_Authentification, async (req, res) => {
   try {
      let product = await Product.findOne({slug: req.query.slug, vendor: req.user.username})

      await product.deleteProduct();

      req.flash('success', 'Product Successfully Deleted');
      res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`);
   } catch (e) {
      console.log(e);
      res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`);
      return;
   }
});

module.exports = router;
