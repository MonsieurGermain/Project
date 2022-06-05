const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const Review = require('../models/review')
const upload = require('../middlewares/multer-user')
const { Validate_Params_Username_User, Validate_Params_Username_User_ReqUser } = require('../middlewares/params-validator')
const { Validate_Profile } = require('../middlewares/input-validation')
const { Need_Authentification } = require('../middlewares/authentication')
const { sanitizeHTML } = require('../middlewares/function')


async function Get_All_Reviews(products) {
    const reviews = []

    for(let i = 0; i < products.length; i++) {
        const review = await Review.find({product_slug : products.slug})
        for(let x = 0; x < review.length; x++) {
            reviews.push(review[x])
        }
    }
    return reviews
}


// Route
router.get('/profile/:username', Validate_Params_Username_User,
async (req, res) => {
    try { 
        const { vendor } = req 
        const products = await Product.find({ vendor : vendor.username}).limit(12)
        
        vendor.description = sanitizeHTML(vendor.description)

        let reviews = await Get_All_Reviews(products)

        res.render('profile', { vendor , products, reviews})

    } catch (err) {
        console.log(err.message)
        res.redirect('/error');
        return
    }
})


router.get('/edit-profile/:username', Need_Authentification, Validate_Params_Username_User_ReqUser,
async (req,res) => {
    const { user } = req 
    const products = await Product.find({ vendor : user.username})

    res.render('profile-edit', { vendor: user , products})
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
        res.redirect(`/profile/${user.username}`)

    } catch (e) {
        console.log(e)
        res.redirect(`/profile/${user.username}`)
    }
})

module.exports = router