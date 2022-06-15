const express = require('express')
const router = express.Router()
const User = require('../models/user')
const bcrypt = require('bcrypt')
const passport = require('passport')
const fs = require('fs')
const passport = require('passport')
const fs = require('fs')
const User = require('../models/user')
const bcrypt = require('bcrypt')
const { Should_Not_Be_Authenticated } = require('../middlewares/authentication')
const { Validate_Login, Validate_Register, Is_UsernameTaken} = require('../middlewares/validation')



function Create_Profile_Pic(username) {
    const img_path = `/uploads/user-img/${username}.png`

    fs.copyFile('./public/default/default.png', `./public${img_path}`, (err) => {
        if (err) throw err;
    });
    return img_path
}


router.get('/login', Should_Not_Be_Authenticated , (req,res) => {
    res.render('login')
})


router.post('/login', Should_Not_Be_Authenticated , Validate_Login, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: `/login`,
    failureFlash: true
}))


router.get('/register', Should_Not_Be_Authenticated , (req,res) => {
    res.render('register', {user : null})
})



router.post('/register', Should_Not_Be_Authenticated , Validate_Register, Is_UsernameTaken, async (req, res) => {
    try {
        let { username , password } = req.body

        const user = new User({
            username,
            password : await bcrypt.hash(password, 11), //Hash Passw
            img_path : Create_Profile_Pic(username),
        })
    
        await user.save()
    
        req.flash('success', 'Account Successfully Created')
        res.redirect('/login')

    } catch (err) {
        console.log(err)
        res.render('register', {user : null});
        return
    }

})

// Redirect to /
router.get('/logout', (req, res) => {
    req.logOut()
    res.redirect('/login')
})

module.exports = router