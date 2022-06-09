const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const Review = require('../models/review')
const upload = require('../middlewares/multer-user')
const { Validate_Params_Username_User, Validate_Params_Username_User_ReqUser } = require('../middlewares/params-validator')
const { Validate_Profile } = require('../middlewares/input-validation')
const { Need_Authentification } = require('../middlewares/authentication')
const { sanitizeHTML, paginatedResults} = require('../middlewares/function')


// Route
router.get('/profile/:username', Validate_Params_Username_User,
async (req, res) => {
    try { 
        const { vendor } = req 
        vendor.description = sanitizeHTML(vendor.description)

        const paginatedProducts = await paginatedResults(Product, req.query.productPage, {vendor : vendor.username})
        const paginatedReviews = await paginatedResults(Review, req.query.reviewPage, {vendor : vendor.username})

        res.render('profile', { vendor , paginatedProducts, paginatedReviews})

    } catch (err) {
        console.log(err.message)
        res.redirect('/error');
        return
    }
})


router.get('/edit-profile/:username', Need_Authentification, Validate_Params_Username_User_ReqUser,
async (req,res) => {
    const { user } = req 
    const paginatedProducts = await paginatedResults(Product, req.query.productPage, {vendor : user.username})
    res.render('profile-edit', { vendor: user , paginatedProducts})
})


router.put('/edit-profile/:username', Need_Authentification, Validate_Params_Username_User_ReqUser,
upload.single('profileImg'),
Validate_Profile,
async (req,res) => { 
    try { 
        const { user } = req 
        const { job, description, achievement, languages } = req.body 
    
        if (req.file) requser.UploadImg(req.file)

        user.job = job
        user.description = description
        user.achievement = achievement
        user.languages = languages
        await user.save()

        req.flash('success', 'Profile Successfully Edited')
        res.redirect(`/profile/${user.username}?productPage=1&reviewPage=1`)

    } catch (e) {
        console.log(e)
        res.redirect(`/profile/${user.username}?productPage=1&reviewPage=1`)
    }
})

module.exports = router