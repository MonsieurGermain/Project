const express = require('express')
const router = express.Router()

const { Validate_Product } = require('../middlewares/input-validation')
const { Validate_Query_Product_Slug, Validate_Params_Slug_Product_Vendor} = require('../middlewares/params-validator')
const { deleteOld_Img } = require('../middlewares/function')
const { Need_Authentification } = require('../middlewares/authentication')
const { Validate_Product, Validate_Params_Slug_Product_Vendor, Validate_Query_Product_Slug } = require('../middlewares/validation')
const { uploadProductImg, deleteOld_Img } = require('../middlewares/function')

//POST
router.post('/create-product', Need_Authentification, uploadProductImg.single('productImage'), Validate_Query_Product_Slug, Validate_Product,
async (req, res) => { 
    try {
        const { product } = req
        const { title, description, message, price, ship_from, allow_hidden, qty_settings, shipping_option, selection_1, selection_2, details} = req.body

        let success_message = product.title ? 'Product Successfully Edited' : 'Product Successfully Created'

        // Title and Slug
        if (!product.title) product.Create_Slug(title, req.user.username)// Create Slug if Creating New Product
        if (product.title && product.title !== title) await product.Change_Slug(title, product.vendor) // If Editing Product and Change Title, Change Slugs


        // Img Path
        if (!product.img_path && !req.file) throw new Error('You need to uploads an Image for your new Product') // If Create New Prod and Submit No Img
        else if (!product.img_path) await product.UploadImg(req.file.filename) // If Create New Product, Upload Img
        else if (product.img_path && req.file) await product.UploadImg(req.file.filename, true) // If Edit Product and Send New Img, Del Old One & Upload Img


        product.title = title 
        product.vendor = req.user.username
        product.description = description
        product.message = message
        product.price = price
        product.ship_from = ship_from
        product.allow_hidden = allow_hidden
        product.selection_1 = selection_1
        product.selection_2 = selection_2
        product.details = details
        product.shipping_option = shipping_option
        product.qty_settings = qty_settings

        await product.save()

        req.flash('success', success_message)
        res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`)

    } catch (e) {
        console.log(e)
        if (req.file) {
            deleteOld_Img(req.file.path)
        }
        res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`);
        return
    }
})

//Delete
router.delete('/delete-product/:slug', Need_Authentification, Validate_Params_Slug_Product_Vendor,
async (req,res) => {
    try {
        const { product } = req

        deleteOld_Img(`./public/${product.img_path}`) //Del Product Pic

        await product.Delete_Orders_And_Reviews() //Del Orders & Reviews on this Product
        await product.delete() // Del the Product itself

        req.flash('success', 'Product Successfully Deleted')
        res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`)
    } catch (e) {
        console.log(e)
        res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`);
        return
    }
})


// GET
router.get('/create-product', 
Need_Authentification, Validate_Query_Product_Slug,
//Is_Vendor,
async (req,res) => {
    const { product } = req
    res.render('product-create', { product })
})

module.exports = router