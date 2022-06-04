const express = require('express')
const router = express.Router()
const User = require('../models/user')
const Product = require('../models/product')
const Review = require('../models/review')
const { Validate_Params_Username_User, Validate_Params_Username_User_ReqUser } = require('../middlewares/params-validator')
const { Validate_Profile } = require('../middlewares/input-validation')
const { Need_Authentification } = require('../middlewares/authentication')
const upload = require('../middlewares/multer-user')

const HtmlFilter = require('html-filter');

function Text_To_Tags(string, symbol, start_tag, end_tag) {
    let splited_string = string.split(symbol)
    if (splited_string.length <= 1) return string // Return If Nothing To format
  
    let Formated_String = splited_string[0]
    splited_string.shift()
  
    let Start_Or_End
    for(let i = 0; i < splited_string.length; i++) {
      if (!Start_Or_End) {
        Formated_String += start_tag
        Start_Or_End = true
      } 
      else {
        Formated_String += end_tag
        Start_Or_End = undefined
      } 
      Formated_String += splited_string[i]
    }
    return Formated_String
}
function sanitizeHTML(object) {
    const filter = new HtmlFilter()
    object = filter.filter(object)

    object = object.split("\n").join("<br>");
    object = Text_To_Tags(object, '**', '<b>', '</b>')
    object = Text_To_Tags(object, '*B', '<h3>', '</h3>')
    object = Text_To_Tags(object, '*M', '<h5>', '</h5>')
    object = Text_To_Tags(object, '*S', '<h6>', '</h6>')
    object = Text_To_Tags(object, '*', ' <em>', '</em>')

    return object;
}

// Bold = ** Italic = * h = /3

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
    const { requser } = req 
    const products = await Product.find({ vendor : requser.username})

    res.render('profile-edit', { vendor: requser , products})
})


router.put('/edit-profile/:username', Need_Authentification, Validate_Params_Username_User_ReqUser,
upload.single('profileImg'),
Validate_Profile,
async (req,res) => { 
    try { 
        const { requser } = req 
        const { job, description, achievement, languages } = req.body 
    
        if (req.file) requser.UploadImg(req.file)

        requser.job = job
        requser.description = description
        requser.achievement = achievement
        requser.languages = languages
        await requser.save()

        res.redirect(`/profile/${requser.username}`)

    } catch (e) {
        console.log(e)
        res.redirect(`/profile/${req.user.username}`)
    }
})

module.exports = router