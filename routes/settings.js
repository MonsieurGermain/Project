const express = require('express')
const router = express.Router()
const { Need_Authentification } = require('../middlewares/authentication')
const User = require('../models/user')
const Product = require('../models/product')
const bcrypt = require('bcrypt')
const { Validate_Change_Password, Validate_AutoDel_Settings,  paramsUsername_isReqUsername, existProduct,  Validate_SectionQuery, Validate_Query_Url} = require('../middlewares/validation')
const { paginatedResults } = require('../middlewares/function')


router.get('/settings/:username', Need_Authentification, paramsUsername_isReqUsername, Validate_SectionQuery,
async (req,res) => { 
    try { 
        const { user } = req
        
        let paginatedProducts
        if (req.query.section === 'saved') paginatedProducts = await paginatedResults(Product, {slug: { $in: user.saved_product }}, {page: req.query.productPage, limit: 24})
        res.render('settings', {user, paginatedProducts})
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})

router.put('/change-autodelete/:username', Need_Authentification, paramsUsername_isReqUsername, Validate_AutoDel_Settings, 
async (req,res) => {
    try { 
        const { user } = req
        const { messages , informations } = req.body

        user.settings.message_expiring = messages
        user.settings.info_expiring = informations

        await user.save()

        res.redirect(`/settings/${user.username}?section=privacy`)
    
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})

router.put('/change-password/:username', Need_Authentification, paramsUsername_isReqUsername, Validate_Change_Password,
async (req,res) => {
    try { 
        const { user } = req
        const { password, newPassword } = req.body
        
        bcrypt.compare(password, req.user.password, (err, match) => {
            if (err) throw new Error('Error')
            if (!match) throw new Error('Invalid Password')
        })

        user.password = await bcrypt.hash(newPassword, 10)

        await user.save()

        req.flash('success', 'Password Successfully Changed')
        res.redirect(`/settings/${user.username}?section=security`)

    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})

router.delete('/delete-user/:username', Need_Authentification, paramsUsername_isReqUsername,
async (req,res) => {
    try { 
        const { user } = req

        await user.Delete_User_Conversation_Etc()
        await user.delete()

        res.redirect('/logout')
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})

router.post('/saved_product/:slug', Need_Authentification, Validate_Query_Url, existProduct,
async (req,res) => {
    try { 
        console.log(req.query)
        const user = await User.findOne({username: req.user.username})
        user.Add_Remove_Saved_Product(req.params.slug)

        await user.save()
        if (req.query.productPage) res.redirect(`/settings/${req.user.username}?section=saved&productPage=${req.query.productPage}`)
        else res.redirect(`${req.query.url}`) 
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})



module.exports = router