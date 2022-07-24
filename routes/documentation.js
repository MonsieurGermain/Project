const express = require('express')
const router = express.Router()
const Contactus = require('../models/contactus')
const { Need_Authentification } = require('../middlewares/authentication')
const { validateContactUs, ValidateValueByChoice, FetchData } = require('../middlewares/validation')
const { paginatedResults } = require('../middlewares/function')

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