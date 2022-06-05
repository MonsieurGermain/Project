const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const Review = require('../models/review')
const User = require('../models/user')
const { Validate_Query_Slug_Product_Required } = require('../middlewares/params-validator')
const { sanitizeHTML } = require('../middlewares/function')


router.get('/products', async (req,res) => {
    try {
        const products = await Product.find().skip(0).limit(24)

        res.render('products', { products })  

    } catch (err) {
        console.log(err)
        res.redirect('/error')
        return
    }
})


router.get('/product', Validate_Query_Slug_Product_Required,
async (req,res) => {
    try {
        const { product } = req
        const vendor = await User.findOne({username : product.vendor})
        let reviews = await Review.find({product_slug : product.slug})

        product.description = sanitizeHTML(product.description)

        res.render('product-single', { product, vendor, reviews })

    } catch (err) {
        console.log(err)
        res.redirect('/error')
        return
    }
})


module.exports = router