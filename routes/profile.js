const express = require('express')
const router = express.Router()
const User = require('../models/user')
const Product = require('../models/product')
const Review = require('../models/review')
const { Need_Authentification, isBuyer } = require('../middlewares/authentication')
const { Validate_Profile, FetchData, paramsUsername_isReqUsername, validateSlugParams} = require('../middlewares/validation')
const { uploadUserImg, sanitizeHTML, paginatedResults} = require('../middlewares/function')


// Route
router.get('/profile/:username', FetchData(['params', 'username'], User, 'username', 'vendor'),
async (req, res) => {
    try { 
        const { vendor } = req 
        vendor.description = sanitizeHTML(vendor.description)

        const productQuery = req.user && req.params.username === req.user.username ? {vendor: vendor.username} : {vendor: vendor.username, status: 'online'} 
        const paginatedProducts = await paginatedResults(Product, productQuery, {page: req.query.productPage})
        const paginatedReviews = await paginatedResults(Review, {vendor : vendor.username}, {page: req.query.reviewPage})

        res.render('profile', { vendor, paginatedProducts, paginatedReviews})

    } catch (err) {
        console.log(err.message)
        res.redirect('/error');
        return
    }
})


router.get('/edit-profile/:username', Need_Authentification, paramsUsername_isReqUsername,
async (req,res) => {
    const { user } = req 
    const paginatedProducts = await paginatedResults(Product, {vendor: user.username, status: 'online'}, {page: req.query.productPage})
    res.render('profile-edit', { vendor: user , paginatedProducts})
})


router.put('/edit-profile/:username', Need_Authentification, paramsUsername_isReqUsername,
uploadUserImg.single('profileImg'),
Validate_Profile,
async (req,res) => { 
    try { 
        const { user } = req 
        const { job, description, achievement, languages } = req.body 
    
        if (req.file) user.UploadImg(req.file)

        user.job = job
        user.description = description
        user.achievement = achievement
        user.languages = languages
        await user.save()

        req.flash('success', 'Profile Successfully Edited')
        res.redirect(`/profile/${user.username}?productPage=1&reviewPage=1`)

    } catch (e) {
        console.log(e)
        res.redirect(`/error`)
    }
})



// Where to put that
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

module.exports = router