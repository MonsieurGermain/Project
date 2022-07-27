const express = require('express')
const router = express.Router()
const User = require('../models/user')
const Order = require('../models/order')
const Report = require('../models/report')
const Product = require('../models/product')
const Contactus = require('../models/contactus')
const { Need_Authentification } = require('../middlewares/authentication')
const { FetchData, ValidateValueByChoice, isOrder_Admin, Validate_disputeWinner, validateReports, isHimself, validateResolveReport} = require('../middlewares/validation')
const { Format_Username_Settings, paginatedResults} = require('../middlewares/function')

function hideBuyerUsername(disputes) {
    for(let i = 0; i < disputes.length; i++) {
        disputes[i].buyer = Format_Username_Settings(disputes[i].buyer, disputes[i].privacy)
    }
    return disputes
}

function constructQuery(query) {
    const mongooseQuery = {}
    if (query.reason) mongooseQuery.reason = query.reason 
    if (query.archived) mongooseQuery.archived = query.archived === 'true' ? {$exists : true} : {$exists : false}   

    return mongooseQuery
}

// User Post Report // Where Should I put that ?
async function check_ifReported_objectExist(req, res, next) {
    try { 
        switch(req.query.type) {
            case 'vendor':
                await User.findOne({username: req.params.id}).orFail(new Error(''))
            break
            case 'product':
                await Product.findOne({slug: req.params.id}).orFail(new Error(''))
            break 
        }
        next()
    } catch (e) {
        console.log('Invalid Reported Items')
        res.redirect('/error')
    }
}
router.post('/report/:id', Need_Authentification,
validateReports,
isHimself({url: ['/profile/', ['user', 'username'], '?productPage=1&reviewPage=1'], message: 'Why do you want to report Yourself ?'}, ['params', 'id']),
ValidateValueByChoice(['query', 'type'], ['vendor', 'product']), 
check_ifReported_objectExist,
async (req,res) => {
    try {
        const { type } = req.query
        const { id } = req.params
        const { reason, username, message } = req.body

        const report = new Report({
            reference_id : id,
            type,
            username,
            message,
            reason,
        })
    
        report.save()
        
        req.flash('success', 'Thank you for your Report, we are now Investigating')
        res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }

})


// Admin Report
router.get('/reports', Need_Authentification, // isAdmin,
ValidateValueByChoice(['query', 'reason'], [undefined, 'scam', 'blackmail', 'information', 'other']), 
ValidateValueByChoice(['query', 'archived'], [undefined, 'true', 'false']),
async (req,res) => {
    try {
        const query = constructQuery(req.query)
        query.ban_requested = {$exists : false}

        const reports = await paginatedResults(Report, query, {page: req.query.reportsPage, limit: 24})

        res.render('admin-reports', { reports })
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})
router.post('/report-filter', Need_Authentification, // isAdmin,
ValidateValueByChoice(['body', 'reason'], ['all', 'scam', 'blackmail', 'information', 'other']), 
ValidateValueByChoice(['body', 'archived'], ['all', 'true', 'false']),
async (req,res) => {
    try {
        const { reason, archived } = req.body

        let query = '?reportsPage=1'
        
        if (reason !== 'all') query += `&reason=${reason}`
        if (archived !== 'all') query += `&archived=${archived}`

        res.redirect(`/reports${query}`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})
router.post('/archive-report/:id', Need_Authentification, // isAdmin,
FetchData(['params', 'id'], Report, undefined, 'report'),
async (req,res) => {
    try {
        const { report } = req

        report.archived = report.archived ? undefined : true

        await report.save()
        res.redirect(`/reports?reportsPage=1`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})
router.post('/dismiss-report/:id', Need_Authentification, // isAdmin,
FetchData(['params', 'id'], Report, undefined, 'report'),
async (req,res) => {
    try {
        const { report } = req

        await report.delete()

        req.flash('success', 'Report Solved')
        res.redirect(`/reports?reportsPage=1`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})
async function getResolveReportDocuments(type, id) {
    let user, product
    switch(type) {
        case 'vendor':
            user = await User.findOne({username: id})
        break
        case 'product' :
            product = await Product.findOne({slug: id})
            user = await User.findOne({username: product.vendor})
        break
        default : throw new Error('Invalid Type')
    }
    return { user, product }
}
router.post('/resolve-report/:id', Need_Authentification, // isAdmin,
validateResolveReport,
FetchData(['params', 'id'], Report, undefined, 'report'),
async (req,res) => {
    try {
        const { report } = req
        const { message, ban, banReason } = req.body

        const { user, product } = await getResolveReportDocuments(report.type, report.reference_id)

        if (product) {
            product.status === 'offline'
            product.save()
        }

        user.warning ++
        if (user.warning > 5) {
            user.Delete_User_Conversation_Etc() 
            user.delete()
        } 
        else user.save()

        let flashMessage = 'The Vendor as been given a warning'
        if (ban) {
            report.ban_requested = true
            report.ban_explanation = banReason
            flashMessage = 'A request to ban this vendor as been made'
            await report.save()
        } 
        else await report.delete()

        
        // Send Message to Vendor

        
        req.flash('success', flashMessage)
        res.redirect(`/reports?reportsPage=1`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})


// Ban User
router.get('/ban-user', Need_Authentification, // isAdmin,
ValidateValueByChoice(['query', 'reason'], [undefined, 'scam', 'blackmail', 'information', 'other']), 
ValidateValueByChoice(['query', 'archived'], [undefined, 'true', 'false']),
async (req,res) => {
    try {
        const query = constructQuery(req.query)
        query.ban_requested = {$exists : true}

        const reports = await paginatedResults(Report, query, {page: req.query.reportsPage, limit: 24})

        res.render('admin-ban-user', { reports })
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})
router.post('/ban-user-filter', Need_Authentification, // isAdmin,
ValidateValueByChoice(['body', 'reason'], ['all', 'scam', 'blackmail', 'information', 'other']), 
ValidateValueByChoice(['body', 'archived'], ['all', 'true', 'false']),
async (req,res) => {
    try {
        const { reason, archived } = req.body

        let query = '?reportsPage=1'
        
        if (reason !== 'all') query += `&reason=${reason}`
        if (archived !== 'all') query += `&archived=${archived}`

        res.redirect(`/ban-user${query}`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})
router.post('/dismiss-report/:id', Need_Authentification, // isAdmin,
FetchData(['params', 'id'], Report, undefined, 'report'),
async (req,res) => {
    try {
        const { report } = req

        await report.delete()

        req.flash('success', 'Ban Request Succesfully Refused')
        res.redirect(`/ban-user?reportsPage=1`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})
router.post('/ban-user/:id', Need_Authentification, // isAdmin,
FetchData(['params', 'id'], Report, undefined, 'report'),
async (req,res) => {
    try {
        const { report } = req
        const { user } = await getResolveReportDocuments(report.type, report.reference_id)

        await user.Delete_User_Conversation_Etc() 
        await user.delete()
        await report.delete()
    
        req.flash('success', 'User Successfully Banned')
        res.redirect(`/ban-user?reportsPage=1`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})



// Disputes
router.get('/disputes', Need_Authentification, //isAdmin,
async (req,res) => {
    try {
        const { adminDispute } = req.query
        
        const query = adminDispute ? {status : 'dispute_progress', admin : req.user.username} : {status : 'dispute_progress', admin: undefined}

        let disputes = await Order.find(query)

        disputes = hideBuyerUsername(disputes)

        res.render('admin-dispute-list', { disputes })
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})
router.post('/disputes/:id', Need_Authentification, //isAdmin,
FetchData(['params', 'id'], Order, undefined, 'order'),
async (req,res) => {
    try {
        const { order } = req

        order.admin = req.user.username
    
        await order.save()

        res.redirect('/disputes')
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})
router.post('/settle-dispute/:id', Need_Authentification, // isAdmin,
FetchData(['params', 'id'], Order, undefined, 'order'), isOrder_Admin, Validate_disputeWinner,
async (req,res) => {
    try {
        const { order, winner } = req

        order.status = 'disputed'
        order.timer = Date.now() + 172800000
        order.dispute_winner = winner
    
        await order.save()

        req.flash('success', 'Dispute Successfully Settle')
        res.redirect(`/disputes?adminDispute=true`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})


// Feedback
router.get('/feedback', Need_Authentification, // isAdmin,
ValidateValueByChoice(['query', 'reason'], [undefined, 'feedback', 'bug', 'help', 'other']), 
ValidateValueByChoice(['query', 'archived'], [undefined, 'true', 'false']),
async (req,res) => {
    try {
        const feedbacks = await paginatedResults(Contactus, constructQuery(req.query), {page: req.query.feedbackPage, limit: 24})

        res.render('admin-feedbacks', { feedbacks })
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})
router.post('/feedback-filter', Need_Authentification, // isAdmin,
ValidateValueByChoice(['body', 'reason'], ['all', 'feedback', 'bug', 'help', 'other']), 
ValidateValueByChoice(['body', 'archived'], ['all', 'true', 'false']),
async (req,res) => {
    try {
        const { reason, archived } = req.body

        let query = '?feedbackPage=1'
        
        if (reason !== 'all') query += `&reason=${reason}`
        if (archived !== 'all') query += `&archived=${archived}`

        res.redirect(`/feedback${query}`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})
router.post('/archive-feedback/:id', Need_Authentification, // isAdmin,
FetchData(['params', 'id'], Contactus, undefined, 'feedback'),
async (req,res) => {
    try {
        const { feedback } = req

        feedback.archived = feedback.archived ? undefined : true

        await feedback.save()
        res.redirect(`/feedback?feedbackPage=1`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})
router.post('/delete-feedback/:id', Need_Authentification, // isAdmin,
FetchData(['params', 'id'], Contactus, undefined, 'feedback'),
async (req,res) => {
    try {
        const { feedback } = req

        await feedback.delete()

        res.redirect(`/feedback?feedbackPage=1`)
    } catch(e) {
        console.log(e)
        res.redirect('/error')
    }
})


// Promote
router.get('/promote-user', Need_Authentification, // isAdmin,
async (req,res) => {
    try {
        const users = await paginatedResults(User, {awaiting_promotion: {$exists: true}}, {page: req.query.usersPage, limit: 24})

        res.render('admin-promote', { users })
    } catch(e) {
        res.redirect('/error')
    }
})
router.post('/promote-user/:username', Need_Authentification, // isAdmin,
FetchData(['params', 'username'], User, 'username', 'user'),
async (req,res) => {
    try {
        const { user } = req

        user.awaiting_promotion = undefined
        if (!req.query.decline) user.authorization = 'vendor' 

        await user.save()
        
        req.flash('success', 'User Sucessfully Promoted')
        res.redirect(`/promote-user?usersPage=1`)
    } catch(e) {
        res.redirect('/error')
    }
})

module.exports = router