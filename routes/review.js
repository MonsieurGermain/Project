const express = require('express')
const router = express.Router()
const { Need_Authentification } = require('../middlewares/authentication')
const Review = require('../models/review')
const User = require('../models/user')
const Product = require('../models/product')
const { Validate_Reviews, existOrder, isOrder_Buyer } = require('../middlewares/validation')
const { Format_Username_Settings } = require('../middlewares/function')


router.post('/create-review/:id', Need_Authentification, existOrder, isOrder_Buyer, Validate_Reviews,
async (req,res) => { 
    const { order } = req

    const review = new Review({
        product_slug : order.product_slug,
        vendor : order.vendor,
        sender : Format_Username_Settings(req.user.username, req.body.type),
        content : req.body.review,
        note : req.body.note,
        type : req.body.type
    })

    order.let_review = true

    let product = await Product.findOne({slug : order.product_slug})
    product.review.number_review += 1
    product.review.total_note += req.body.note
    product.review.average_note = product.review.total_note / product.review.number_review 


    let user = await User.findOne({username : order.vendor})
    user.review.number_review += 1
    user.review.total_note += req.body.note
    user.review.average_note = user.review.total_note / user.review.number_review 

    await user.save()
    await product.save()
    await review.save()
    await order.save()

    res.redirect(`/order-resume/${req.params.id}`)
})

module.exports = router