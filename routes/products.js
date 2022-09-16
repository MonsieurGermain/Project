const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const Review = require('../models/review');
const User = require('../models/user');
const fileUpload = require("express-fileupload");
const { ImageUploadsValidation, uploadsFiles, deleteImage } = require('../middlewares/filesUploads')
const {Need_Authentification, isVendor} = require('../middlewares/authentication');
const {Validate_Product, sanitizeParams, sanitizeQuerys, sanitizeParamsQuerys} = require('../middlewares/validation');
const {sanitizeHTML, paginatedResults} = require('../middlewares/function');


function uploadsMainProductImage(imgPaths, mainProductImage) {
   if (!imgPaths.length && !mainProductImage) throw new Error('You need to uploads an Image for your new Product'); // If Create New Product and Submit No Img
   if (!imgPaths.length && mainProductImage) return uploadsFiles(mainProductImage, 'product', true)
   if (imgPaths.length && mainProductImage) return uploadsFiles(mainProductImage, `./uploads${imgPaths[0]}`, false)
   
   return imgPaths[0]
}

function deleteAdditionnalImages(imgPaths, indexOfImageToDelete){
   if (!indexOfImageToDelete) return imgPaths

   for(let i = 0; i < 2; i++) {
      deleteImage(`./uploads${imgPaths[indexOfImageToDelete[i]]}`);
      imgPaths[indexOfImageToDelete[i]] = undefined
   }

   return imgPaths.filter((element) => element)
}


function uploadsAdditionnalImages(imgPaths, secondaryProductImages) {
   if (!secondaryProductImages) return imgPaths

   for(let i = 1; i < imgPaths.length; i++) {
      deleteImage(`./uploads${imgPaths[i]}`);
      imgPaths[i] = undefined
   }

   imgPaths = imgPaths.filter((element) => element)

   for(let i = 0; i < secondaryProductImages.length; i++) {
      imgPaths.push(uploadsFiles([secondaryProductImages[i]], 'product', true))
   }

   return imgPaths
}


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


router.get('/products', sanitizeQuerys, async (req, res) => {
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

router.get('/product/:slug', sanitizeParamsQuerys, async (req, res) => {
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
router.get('/create-product', Need_Authentification, isVendor, sanitizeQuerys,
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
router.post('/create-product', Need_Authentification, sanitizeQuerys, 
fileUpload({ createParentPath: true }),
ImageUploadsValidation({errorUrl: '/create-product'}),
async(req,res, next) => {
   try { 
      const product = await Product.findOneOrCreateNew(req.query.slug, req.user.username)

      req.product = product ? product : new Product();

      next()
   } catch (e) {
      res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`)
   }
},
Validate_Product, 
async (req, res) => {
   try {
      const {
         productImage,
         additionnalProductImage,
         deleteAdditionnalImg,
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
         aboutProduct,
         productDetails,
         salesPrice,
         salesDuration,
         stop_sales,
         status,
         customMoneroAddress,
      } = req.body;

      const {product} = req

      let success_message = product.title ? 'Product Successfully Edited' : 'Product Successfully Created';

      if (product.title !== title) {
         const isProductTitleTaken = await Product.findOne({title: title, vendor: req.user.username})
         if (isProductTitleTaken) throw new Error('You cant have the same title for multiple products')
      }

      // price
      if (stop_sales) {
         product.endSales();
      } else if (!product.title) {
         product.price = price;
      } else {
         if (!product.originalPrice && salesPrice) {
            product.startSales(salesPrice, salesDuration);
         } else {
            product.price = price;
         }
      }

      // Title and Slug
      if (!product.title) product.createSlug(title, req.user.username); // Create Slug if Creating New Product
      if (product.title && product.title !== title) await product.changeSlug(title, product.vendor); // If Editing Product and Change Title, Change Slugs


      // Img Path
      product.img_path[0] = uploadsMainProductImage(product.img_path, productImage)

      // Delete Additionnal Product Img
      product.img_path = deleteAdditionnalImages(product.img_path, deleteAdditionnalImg)

      // Add new Additionnal Product Img
      product.img_path = uploadsAdditionnalImages(product.img_path, additionnalProductImage)

      product.title = title;
      product.vendor = req.user.username;
      product.description = description;
      product.productDetails = productDetails;
      product.aboutProduct = aboutProduct;
      product.message = message;
      product.ship_from = ship_from;
      product.allow_hidden = allow_hidden;
      product.selection_1 = selection_1;
      product.selection_2 = selection_2;
      product.shipping_option = shipping_option;
      product.qty_settings = qty_settings;
      product.customMoneroAddress = customMoneroAddress;
      product.status = req.user.vendorMoneroAddress || product.customMoneroAddress ? status : 'offline';


      await product.save();


      if (product.status === 'offline' && status === 'online') {
         req.flash('warning', 'You need to add a Monero Address to your account or a custom Monero address to the Product in order to put it online');
      } else if (status === 'offline') {
         req.flash('warning', `${success_message} and Offline`);
      } else {        
         req.flash('success', success_message);
      }
      res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`);

   } catch (e) {
      console.log(e)
      req.flash('error', e.message)
      res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`);
   }
});

//Delete
router.delete('/delete-product/:slug', Need_Authentification, sanitizeParams, async (req, res) => {
   try {
      let product = await Product.findOne({slug: req.params.slug, vendor: req.user.username})

      if (!product) throw new Error('Invalid Slug Params')

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
