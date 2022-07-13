const express = require('express')
const router = express.Router()
const { Need_Authentification } = require('../middlewares/authentication')
const User = require('../models/user')
const Product = require('../models/product')
const bcrypt = require('bcrypt')
const { ValidateValueByChoice, Validate_Change_Password, Validate_AutoDel_Settings,  paramsUsername_isReqUsername, FetchData, Validate_Query_Url, Validate_Email, Validate_Pgp, Validate_Pgp_Verification} = require('../middlewares/validation')
const { paginatedResults, RandomNumber, IsNot_String, RandomList_ofWords} = require('../middlewares/function')

router.get('/settings/:username', Need_Authentification, paramsUsername_isReqUsername, 
ValidateValueByChoice(['query', 'section'], [undefined,'security', 'privacy', 'saved']),
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


router.post('/add-pgp', Need_Authentification, Validate_Pgp,
async (req,res) => {
    try {
        const { user } = req
        const { pgp } = req.body
        let flash_message

        if (pgp) {
            user.pgp_keys = pgp
            user.pgp_keys_verification_words = RandomList_ofWords(12)
            user.pgp_keys_verification_words_encrypted = user.pgp_keys_verification_words // Encrypt It with user pgp
            flash_message = 'A new Pgp Keys as Been added, you just need Verify it'
        } else { 
            user.pgp_keys = undefined
            user.pgp_keys_verification_words = undefined
            user.pgp_keys_verification_words_encrypted = undefined
            flash_message = 'Your Pgp Keys as been Deleted'    
        }

        // Send Email Containning Verification Code
        await user.save()

        req.flash('success', flash_message)
        res.redirect(`/settings/${user.username}?sec=security`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})
router.post('/verify-pgp', Need_Authentification, Validate_Pgp_Verification,
async (req,res) => {
    try {
        const { user } = req

        user.pgp_keys_verification_words = undefined
        user.pgp_keys_verification_words_encrypted = undefined

        await user.save()

        req.flash('success', 'Pgp Successfully Verified')
        res.redirect(`/settings/${user.username}?sec=security`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})


router.post('/add-email', Need_Authentification, Validate_Email,
async (req,res) => {
    try {
        const { user } = req
        const old_email = user.email
        let flash_message
        
        user.email = req.body.email
        

        if (!user.email && !old_email) flash_message = 'No Email Added'
        else if (!user.email) flash_message = 'Email Address Removed'
        else if (user.email === old_email) flash_message = 'You already have entered this Email Address'
        else flash_message = 'Please Go check your Email inbox to confirm your new Email Address'


        if (user.email && old_email !== user.email) {
            user.email_verification_code = RandomNumber(6)
            console.log(`The Verification Code is: ${user.email_verification_code}`)
        }
        if (!user.email && user.email_verification_code) user.email_verification_code = undefined
        if (!user.email && user.settings.step_verification) {
            user.settings.step_verification = undefined
        }

        // Send Email Containning Verification Code

        await user.save()

        req.flash('success', flash_message)
        res.redirect(`/settings/${user.username}?sec=security`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})
router.post('/confirm-email', Need_Authentification, async (req,res) => {
    try {
        const { user } = req
        const confirmation_code = req.body.confirmation_code.trim()
        let flash_message

        if (!user.email_verification_code) throw new Error('No Email to verify')
        if (IsNot_String(confirmation_code) || confirmation_code.length !== 6 ) throw new Error('Invalid Confirmation Code') // Validation


        if (user.email_verification_code === confirmation_code) {
            user.email_verification_code = undefined
            flash_message = { type : 'success', msg : 'Email Successfully Verified' }
        } else { 
            flash_message = { type : 'error', msg : 'Invalid Confirmation Code' }
        }

        await user.save()

        req.flash( flash_message.type , flash_message.msg)
        res.redirect(`/settings/${user.username}?sec=security`)
    } catch(e) {
        req.flash('error' , e.message)
        res.redirect(`/settings/${req.user.username}?sec=security`)
    }
}) 
router.post('/resend-email-verification', Need_Authentification, async (req,res) => {
    try {
        const { user } = req
        let flash_message

        if (user.email && user.email_verification_code) user.email_verification_code = RandomNumber(6)
        else throw new Error('No Email addres to verified') 

        // Resend Email with new Confirmation Code
        
        await user.save()

        req.flash('success', "Verifaction Code Resended")
        res.redirect(`/settings/${user.username}?sec=security`)
    } catch(e) {
        console.log(e)
        res.redirect(`/settings/${req.user.username}?sec=security`)
    }
}) 

router.post('/enable-2fa', Need_Authentification, async (req,res) => {
    try {
        const { user } = req
        const step_verification = req.body.step_verification

        // Validation
        if (step_verification === 'email') {
            if (user.email_verification_code || !user.email) throw new Error('You cant Add Email 2 Step Verification')
        }
        else if (step_verification === 'pgp') {
            if (user.pgp_keys_verification_words || !user.pgp_keys) throw new Error('You cant Add Email 2 Step Verification')
        }
        else throw new Error('Invalid Value')  

        let flash_message
        if (user.settings.step_verification) flash_message = "2 Step Verification Successfully Changed"
        else flash_message = "2 Step Verification Successfully Added"

        user.settings.step_verification = step_verification
        
        await user.save()

        req.flash('success', flash_message)
        res.redirect(`/settings/${user.username}?sec=security`)
    } catch(e) {
        console.log(e)
        res.redirect(`/error`)
    }
}) 
router.post('/remove-2fa', Need_Authentification, async (req,res) => {
    try {
        const { user } = req

        user.settings.step_verification = undefined

        await user.save()

        req.flash('success', '2 Step Verification Successfully Removed')
        res.redirect(`/settings/${user.username}?sec=security`)
    } catch(e) {
        console.log(e)
        res.redirect(`/error`)
    }
}) 

router.put('/change-autodelete/:username', Need_Authentification, paramsUsername_isReqUsername, Validate_AutoDel_Settings, 
async (req,res) => {
    try { 
        const { user } = req
        const { messages , informations, userDel } = req.body

        user.settings.message_expiring = messages
        user.settings.info_expiring = informations
        user.settings.user_expiring = userDel

        if (user.settings.user_expiring) user.expire_at = Date.now() + user.settings.user_expiring * 86400000
        else user.expire_at = undefined

        await user.save()

        res.redirect(`/settings/${user.username}?section=privacy`)
    
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})

router.post('/remove-2fa', Need_Authentification, async (req,res) => {
    try {
        const { user } = req

        user.settings.step_verification = undefined
        
        await user.save()

        req.flash('success', "2 Step Verification Successfully Removed")
        res.redirect(`/settings/${user.username}?sec=security`)
    } catch(e) {
        console.log(e)
        res.redirect(`/error`)
    }
}) 


router.put('/change-password/:username', Need_Authentification, paramsUsername_isReqUsername, Validate_Change_Password,
async (req,res) => {
    try { 
        const { user } = req
        const { password, newPassword } = req.body
        
        if (!bcrypt.compareSync(password, user.password)) throw new Error('Invalid Password')

        user.password = await bcrypt.hash(newPassword, 10)

        await user.save()

        req.flash('success', 'Password Successfully Changed')
        res.redirect(`/settings/${user.username}?section=security`)

    } catch(e) {
        req.flash('error', e.message)
        res.redirect(`/settings/${req.user.username}?section=security`)
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

router.post('/saved_product/:slug', Need_Authentification, Validate_Query_Url, FetchData(['params', 'slug'], Product, 'slug', 'product'),
async (req,res) => {
    try { 
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