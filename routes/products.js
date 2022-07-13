const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const Review = require('../models/review')
const User = require('../models/user')
const { FetchData } = require('../middlewares/validation')
const { sanitizeHTML, paginatedResults } = require('../middlewares/function')

const Fuse = require('fuse.js')
// Create Fuzzy Product Collecion
var fusedProduct 
Product.find({}).then(products => { 
    const options = {
        threshold: 0.3,
        keys: ['title', 'vendor']
    }    
    fusedProduct = new Fuse(products, options);
})
// Update Fuzzy Product Collecion
setInterval(() => {
    Product.find({}).then(products => { 
        const options = {
            threshold: 0.23,
            keys: ['title', 'vendor']
        }    
        fusedProduct = new Fuse(products, options);
    })
}, 300000); // 5min 300000



router.get('/products', async (req,res) => {
    try {
        let paginatedProducts
        let productsFuzzy
        if (req.query.search) {
            const productFused = fusedProduct.search(req.query.search);
            productsFuzzy = productFused.map(({ item }) => item);
        }
        paginatedProducts = await paginatedResults(Product, {}, {page: req.query.productPage, limit: 24}, productsFuzzy)

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
async (req,res) => {
    try {
        const { product } = req
        const vendor = await User.findOne({username : product.vendor})
        const paginatedReviews = await paginatedResults(Review, {product_slug : product.slug}, {page: req.query.reviewPage}) 

        product.description = sanitizeHTML(product.description)

        res.render('product-single', { product, vendor, paginatedReviews })

    } catch (err) {
        console.log(err)
        res.redirect('/error')
        return
    }
})



module.exports = router