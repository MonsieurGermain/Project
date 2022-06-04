const express = require('express')
const router = express.Router()
const Product = require('../models/product')
const Review = require('../models/review')
const User = require('../models/user')
const { Validate_Query_Slug_Product_Required } = require('../middlewares/params-validator')

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


router.get('/products', async (req,res) => {
    try {
        const products = await Product.find().skip(0).limit(24)

        res.render('products', { products })  

    } catch (err) {
        console.log(err)
        res.redirect('/error')
        return
    }
})


router.get('/product', Validate_Query_Slug_Product_Required,
async (req,res) => {
    try {
        const { product } = req
        const vendor = await User.findOne({username : product.vendor})
        let reviews = await Review.find({product_slug : product.slug})

        product.description = sanitizeHTML(product.description)

        res.render('product-single', { product, vendor, reviews })

    } catch (err) {
        console.log(err)
        res.redirect('/error')
        return
    }
})


module.exports = router