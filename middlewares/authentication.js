exports.Need_Authentification = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next()
    }

    console.log('You need to login')
    res.redirect('/login')
}

exports.Should_Not_Be_Authenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        console.log('you are already auth')
        return res.redirect('/')
    }
    next()
}

exports.Is_Vendor = (req,res, next) => {
    if (req.user.auth === 'Vendor') {
        next(); return
    }

    console.log('Need to be a Vendor')
    res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`)
}

