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

exports.isBuyer = (req,res, next) => {
    if (req.user.authorization === 'buyer') {
        next(); return
    }

    console.log('You need to be a buyer to perform this action')
    res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`)
}

exports.isVendor = (req,res, next) => {
    if (req.user.authorization === 'vendor') {
        next(); return
    }

    console.log('You need to be a Vendor to perform this action')
    res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`)
}

exports.isAdmin = (req,res, next) => {
    if (req.user.authorization === 'admin') {
        next(); return
    }

    console.log('You need to be an Admin to perform this action')
    res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`) // change that
}