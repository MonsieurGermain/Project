const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const Order = require('../models/order')
const User = require('../models/user')
const { Need_Authentification } = require('../middlewares/authentication')
const { getDispute_inProgress, FetchData,  isOrder_VendorOrBuyer, isOrder_Admin, Validate_disputeWinner, get_adminDispute } = require('../middlewares/validation')
const { Format_Username_Settings } = require('../middlewares/function')

// Make dipsute admin take page
// Change order resume to fit dispute/ dispute in progress status, permit admin to send message
router.post('/create-dispute/:id', Need_Authentification, FetchData(['params', 'id'], Order, undefined, 'order'), isOrder_VendorOrBuyer,
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


module.exports = router