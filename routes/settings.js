const express = require('express')
const router = express.Router()
const { Need_Authentification } = require('../middlewares/authentication')
const User = require('../models/user')
const Product = require('../models/product')
const bcrypt = require('bcrypt')
const { Validate_Change_Password, Validate_AutoDel_Settings} = require('../middlewares/input-validation')
const { Validate_Params_Username_User_ReqUser, Validate_Params_Slug_Product} = require('../middlewares/params-validator')
const { Validate_Query_Section_Settings, Validate_Query_Url} = require('../middlewares/custom-validation')

async function Get_Saved_Product(saved_product) {
    const Saved_Product = []

    for(let i = 0; i < saved_product.length; i++) {
        const product = await Product.findOne({slug: saved_product[i]})
        Saved_Product.push(product) 
    }
    return Saved_Product
}


router.get('/settings/:username', Need_Authentification, Validate_Query_Section_Settings,
async (req,res) => { 
    try { 
        const { user } = req
        
        let products
        if (req.query.section === 'saved') products = await Get_Saved_Product(user.saved_product)

        res.render('settings', {user, products})
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})

router.put('/change-autodelete/:username', Need_Authentification, Validate_Params_Username_User_ReqUser, Validate_AutoDel_Settings, 
async (req,res) => {
    try { 
        const { requser } = req
        const { messages , informations } = req.body

        requser.settings.message_expiring = messages
        requser.settings.info_expiring = informations

        await requser.save()

        res.redirect(`/settings/${requser.username}?section=privacy`)
    
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})

router.put('/change-password/:username', Need_Authentification, Validate_Params_Username_User_ReqUser, Validate_Change_Password,
async (req,res) => {
    try { 
        const { requser } = req
        const { password, newPassword } = req.body
        
        bcrypt.compare(password, req.user.password, (err, match) => {
            if (err) throw new Error('Error')
            if (!match) throw new Error('Invalid Password')
        })

        requser.password = await bcrypt.hash(newPassword, 10)

        await requser.save()

        req.flash('success', 'Password Successfully Changed')
        res.redirect(`/settings/${requser.username}?section=security`)

    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})

router.delete('/delete-user/:username', Need_Authentification, Validate_Params_Username_User_ReqUser,
async (req,res) => {
    try { 
        const { requser } = req

        await requser.Delete_User_Conversation_Etc()
        await requser.delete()

        res.redirect('/logout')
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})

router.post('/saved_product/:slug', Need_Authentification, Validate_Query_Url, Validate_Params_Slug_Product,
async (req,res) => {
    try { 
        const user = await User.findOne({username: req.user.username})
        user.Add_Remove_Saved_Product(req.params.slug)

        await user.save()

        res.redirect(`${req.query.url}`)
        
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})



module.exports = router