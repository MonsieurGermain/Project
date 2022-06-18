const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const Order = require('../models/order')
const User = require('../models/user')
const { Need_Authentification } = require('../middlewares/authentication')
const { Validate_ProvidedInfo, Validate_Update_Order, existProduct, existOrder, isOrder_Buyer, isOrder_VendorOrBuyer, isOrder_Admin, winnerQuery_ispartOrder, Validate_Params_Username_Order,  Validate_OrderCustomization  } = require('../middlewares/validation')
const { Format_Username_Settings } = require('../middlewares/function')

// Make dipsute admin take page
// Change order resume to fit dispute/ dispute in progress status, permit admin to send message
router.post('/create-dispute/:id', Need_Authentification, existOrder, isOrder_VendorOrBuyer,
async (req,res) => {
    try {
        const { order } = req

        order.status = 'dispute_progress'
        order.timer = undefined
    
        await order.save()

        res.redirect(`/order-resume/${order.id}`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})

router.post('/admin-take-dispute/:id', Need_Authentification, existOrder,
async (req,res) => {
    try {
        const { order } = req

        order.admin = req.user.username
    
        await order.save()

        res.redirect(`/dispute-taken/${req.user.username}`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})

router.post('/settle-dispute/:id', Need_Authentification, existOrder, isOrder_Admin, winnerQuery_ispartOrder,
async (req,res) => {
    try {
        const { order } = req

        order.status = 'disputed'
        order.timer = 172800000
        order.dispute_winner = req.query.winner
    
        await order.save()

        res.redirect(`/admin-panel`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})


module.exports = router