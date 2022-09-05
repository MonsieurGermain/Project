const express = require('express')
const router = express.Router()
const Contactus = require('../models/contactus')
const { validateContactUs} = require('../middlewares/validation')

// User Docs
router.get('/news', async (req,res) => {
    res.render('news')
})
router.get('/docs', async (req,res) => {
    res.render('documentation')
})
router.get('/contactus', async (req,res) => {
    res.render('contact')
})
router.post('/contactus', validateContactUs, async (req,res) => {
    try {  
        const { username, email, message, reason } = req.body

        const contactUs = new Contactus ({
            username : username && req.user.username ? req.user.username : undefined,
            email : email,
            message : message,
            reason : reason
        })

        contactUs.save()

        req.flash('success', 'Message Successfully Sent')
        res.redirect('/contactus')
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})

module.exports = router