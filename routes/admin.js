const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const Order = require('../models/order')
const User = require('../models/user')
const { Need_Authentification,  isBuyer, isAdmin } = require('../middlewares/authentication')
const { getDispute_inProgress, FetchData,  isOrder_VendorOrBuyer, isOrder_Admin, Validate_disputeWinner, get_adminDispute } = require('../middlewares/validation')
const { paginatedResults } = require('../middlewares/function')

// Dispute
router.get('/admin-disputes-list', Need_Authentification, //isAdmin,
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
router.post('/admin-take-dispute/:id', Need_Authentification, //isAdmin,
FetchData(['params', 'id'], Order, undefined, 'order'),
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
router.post('/settle-dispute/:id', Need_Authentification, // isAdmin,
FetchData(['params', 'id'], Order, undefined, 'order'), isOrder_Admin, Validate_disputeWinner,
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