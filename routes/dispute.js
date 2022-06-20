const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const Order = require('../models/order')
const User = require('../models/user')
const { Need_Authentification } = require('../middlewares/authentication')
const { getDispute_inProgress, existOrder,  isOrder_VendorOrBuyer, isOrder_Admin, Validate_disputeWinner, get_adminDispute } = require('../middlewares/validation')
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


router.get('/admin-disputes-list', Need_Authentification, //is_Admin,
get_adminDispute, getDispute_inProgress,
async (req,res) => {
    try {
        const { adminDisputes, disputes } = req

        res.render('admin-dispute-list', { adminDisputes, disputes })
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})


router.post('/admin-take-dispute/:id', Need_Authentification, //is_Admin,
existOrder,
async (req,res) => {
    try {
        const { order } = req

        order.admin = req.user.username
    
        await order.save()

        res.redirect('/admin-disputes-list')
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})



router.post('/settle-dispute/:id', Need_Authentification, // is_Admin,
existOrder, isOrder_Admin, Validate_disputeWinner,
async (req,res) => {
    try {
        const { order, winner } = req

        order.status = 'disputed'
        order.timer = Date.now() + 172800000
        order.dispute_winner = winner
    
        await order.save()

        req.flash('success', 'Dispute Settle')
        res.redirect(`/admin-disputes-list`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})


module.exports = router