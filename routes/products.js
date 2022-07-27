const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const Review = require('../models/review')
const User = require('../models/user')
const { Need_Authentification } = require('../middlewares/authentication')
const { Validate_Product, FetchData, isProduct_Vendor, Validate_Query_Product_Slug, Is_titleTaken, validateSlugParams} = require('../middlewares/validation')
const { uploadProductImg, deleteOld_Img, sanitizeHTML, paginatedResults } = require('../middlewares/function')

const Fuse = require('fuse.js')
// Create Fuzzy Product Collecion
var fusedProduct = 
Product.find({status: 'online'}).then(products => { 
    const options = {
        threshold: 0.4,
        keys: ['title', 'vendor']
    }    
    fusedProduct = new Fuse(products, options);
})
// Update Fuzzy Product Collecion
setInterval(() => {
    Product.find({status: 'online'}).then(products => { 
        const options = {
            threshold: 0.4,
            keys: ['title', 'vendor']
        }    
        fusedProduct = new Fuse(products, options);
    })
}, 300000); // 5min 300000


// Dont Get Local Product
router.get('/products', async (req,res) => {
    try {
        let paginatedProducts
        let productsFuzzy
        if (req.query.search) {
            const productFused = fusedProduct.search(req.query.search);
            productsFuzzy = productFused.map(({ item }) => item);
        }
        paginatedProducts = await paginatedResults(Product, {status: 'online'}, {page: req.query.productPage, limit: 24}, productsFuzzy)

        res.render('products', { paginatedProducts })  

    } catch (err) {
        console.log(err)
        res.redirect('/error')
        return
    }
})

router.post('/products', async (req,res) => {
    res.redirect(`/products?search=${req.body.search}&productPage=1`)
})


router.get('/product/:slug', FetchData(['params', 'slug'], Product, 'slug', 'product'),
validateSlugParams,
async (req,res) => {
    try {
        const product = await Product.findOne({slug: req.params.slug})
        if (product.status === 'offline' && product.vendor !== req.user.username) throw new Error('Product Offline')
        const vendor = await User.findOne({username : product.vendor})
        const paginatedReviews = await paginatedResults(Review, {product_slug : product.slug}, {page: req.query.reviewPage}) 

        product.description = sanitizeHTML(product.description)

        res.render('product-single', { product, vendor, paginatedReviews })

    } catch (err) {
        console.log(err)
        res.redirect('/404')
        return
    }
})



// GET
router.get('/create-product', 
Need_Authentification, Validate_Query_Product_Slug,
//isVendor,
async (req,res) => {
    const { product } = req
    res.render('product-create', { product })
})

//POST
router.post('/create-product', Need_Authentification, uploadProductImg.single('productImage'), 
Validate_Query_Product_Slug, 
Validate_Product, 
Is_titleTaken,
async (req, res) => { 
    try {
        const { product } = req
        const { title, description, message, price, ship_from, allow_hidden, qty_settings, shipping_option, selection_1, selection_2, details, sales_price, sales_time, stop_sales, status} = req.body

        let success_message = product.title ? 'Product Successfully Edited' : 'Product Successfully Created'

        // Title and Slug
        if (!product.title) product.Create_Slug(title, req.user.username)// Create Slug if Creating New Product
        if (product.title && product.title !== title) await product.Change_Slug(title, product.vendor) // If Editing Product and Change Title, Change Slugs


        // Img Path
        if (!product.img_path && !req.file) throw new Error('You need to uploads an Image for your new Product') // If Create New Prod and Submit No Img
        else if (!product.img_path) await product.UploadImg(req.file.filename) // If Create New Product, Upload Img
        else if (product.img_path && req.file) await product.UploadImg(req.file.filename, true) // If Edit Product and Send New Img, Del Old One & Upload Img


        // price
        if (product.title && sales_price && !product.default_price) {
            product.default_price = product.price
            product.price = sales_price
            product.sales_time = sales_time
            product.sales_end = Date.now() + (86400000 * sales_time)      
        } 
        else if (product.title && product.price !== price && product.default_price) {
            product.price = price
            product.default_price = undefined
            product.sales_end = undefined

            req.flash('warning', 'Since you have change the Price of your Offer, The sales as been ended')
        }
        else product.price = price
        
        console.log(req.body)
        if (stop_sales) product.endSales() // End Sales
        console.log(product)

        product.title = title 
        product.vendor = req.user.username
        product.description = description
        product.message = message
        product.ship_from = ship_from
        product.allow_hidden = allow_hidden
        product.selection_1 = selection_1
        product.selection_2 = selection_2
        product.details = details
        product.shipping_option = shipping_option
        product.qty_settings = qty_settings
        product.status = status

        await product.save()

        req.flash('success', success_message)
        res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`)

    } catch (e) {
        console.log(e)
        if (req.file) {
            deleteOld_Img(req.file.path)
        }
        res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`);
        return
    }
})

//Delete
router.delete('/delete-product/:slug', Need_Authentification, 
FetchData(['params', 'slug'], Product, 'slug', 'product'), 
isProduct_Vendor,
async (req,res) => {
    try {
        const { product } = req

        await product.Delete_Orders_And_Reviews() //Del Orders & Reviews on this Product
        await product.delete() // Del the Product itself

        req.flash('success', 'Product Successfully Deleted')
        res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`)
    } catch (e) {
        console.log(e)
        res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`);
        return
    }
})



module.exports = router