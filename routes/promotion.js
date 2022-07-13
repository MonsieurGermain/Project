const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const Order = require('../models/order')
const User = require('../models/user')
const { Need_Authentification,  isBuyer, isAdmin } = require('../middlewares/authentication')
const { getDispute_inProgress, FetchData,  isOrder_VendorOrBuyer, isOrder_Admin, Validate_disputeWinner, get_adminDispute } = require('../middlewares/validation')
const { paginatedResults } = require('../middlewares/function')


router.post('/awaiting-promotion', Need_Authentification, isBuyer,
async (req,res) => {
    try {
        const { user } = req

        user.awaiting_promotion = true

        await user.save()

        req.flash('success', 'You submission to become a Vendor as been send')
        res.redirect(`/profile/${user.username}?productPage=1&reviewPage=1`)
    } catch(e) {
        res.redirect('/error')
    }
})

router.get('/promote-user', Need_Authentification, // isAdmin,
async (req,res) => {
    try {
        const users = await paginatedResults(User, {awaiting_promotion: {$exists: true}}, {page: req.query.usersPage, limit: 24})

        res.render('admin-promote', { users })
    } catch(e) {
        res.redirect('/error')
    }
})

router.post('/promote-user/:username', Need_Authentification, // isAdmin,
FetchData(['params', 'username'], User, 'username', 'user'),
async (req,res) => {
    try {
        const { user } = req

        if (req.query.decline) user.awaiting_promotion = undefined
        else user.authorization = 'vendor'

        await user.save()
        
        req.flash('success', 'Congradulation, you are now a vendor')
        res.redirect(`/profile/${user.username}?productPage=1&reviewPage=1`)
    } catch(e) {
        res.redirect('/error')
    }
})


module.exports = router