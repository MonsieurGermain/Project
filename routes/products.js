const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const Review = require('../models/review')
const User = require('../models/user')
const { Validate_Params_Slug_Product } = require('../middlewares/params-validator')
const { sanitizeHTML, paginatedResults } = require('../middlewares/function')

router.get('/products', async (req,res) => {
    try {
        const paginatedProducts = await paginatedResults(Product, req.query.productPage, {}, 24)

        res.render('products', { paginatedProducts })  

    } catch (err) {
        console.log(err)
        res.redirect('/error')
        return
    }
})


router.get('/product/:slug', Validate_Params_Slug_Product,
async (req,res) => {
    try {
        const { product } = req
        const vendor = await User.findOne({username : product.vendor})
        const paginatedReviews = await paginatedResults(Review, req.query.reviewPage, {product_slug : product.slug}) 

        product.description = sanitizeHTML(product.description)

        res.render('product-single', { product, vendor, paginatedReviews })

    } catch (err) {
        console.log(err)
        res.redirect('/error')
        return
    }
})


module.exports = router