const express = require('express')
const { Need_Authentification } = require('../middlewares/authentication')
const router = express.Router()
const Order = require('../models/order') 
const Report = require('../models/report')
const { Format_Username_Settings } = require('../middlewares/function')


function Find_SelectedDispute(disputes, id) {
    let dispute
    for(let i = 0; i < disputes.length; i++) {
        if (disputes[i].id === id) {
            dispute = disputes[i]
            break
        }
    }
    return dispute
}



router.get('/admin', Need_Authentification, //Is_Admin,
async (req,res) => {
    res.render('admin')
})


// Take Dispute
router.get('/admin/take-dipsute', Need_Authentification, 
async (req , res) => {
    let disputes = await Order.find({status: 'dispute_progress', admin : undefined})
    disputes = Format_Username_Settings(disputes)

    res.render('admin-take', {disputes})
})

router.post('/admin/take-dipsute/:id', Need_Authentification, 
async (req , res) => {
    const dispute = await Order.findById(req.params.id)
    dispute.admin = req.user.username

    await dispute.save()

    res.redirect('/admin/take-dipsute')
})


// Resolve
router.get('/admin/resolve-dipsute', Need_Authentification, 
async (req , res) => { 
    let disputes =  await Order.find({admin: req.user.username})
    disputes = Format_Username_Settings(disputes)

    res.render('admin-resolve', {disputes, selected_dispute : disputes[0]})
})


router.get('/admin/resolve-dipsute/:id', Need_Authentification, 
async (req , res) => {
    let disputes =  await Order.find({admin: req.user.username})
    disputes = Format_Username_Settings(disputes)

    selected_dispute = Find_SelectedDispute(disputes, req.params.id)

    res.render('admin-resolve', {disputes, selected_dispute})
})


router.post('/admin/resolve-dipsute/send-message/:id', Need_Authentification,
async (req,res) => {
    const order = await Order.findById(req.params.id)
    order.New_Submited_Info(req.body.content, req.user.username, order.privacy)

    await order.save()
    res.redirect(`/admin/resolve-dipsute/${req.params.id}`)
})


router.post('/admin/resolve-dipsute/:id', Need_Authentification,
async (req,res) => {
    let dispute =  await Order.findById(req.params.id)

    dispute.status = 'disputed'
    dispute.dispute_winner = req.body.winner === dispute.vendor ? dispute.vendor : dispute.buyer  
    
    // HANDLE PAYMENT

    dispute.save()

    res.redirect('/admin/resolve-dipsute')
})


router.get('/reports', Need_Authentification,
async (req,res) => { 
    const reports = await Report.find({archived: undefined})
    const archived_report = await Report.find({archived : true})

    res.render('admin-reports', {reports, archived_report})
})



router.put('/archive-reports/:id', Need_Authentification,
async (req,res) => {
    const report = await Report.findById(req.params.id)
    
    report.archived = true
    report.save()

    req.redirect('/reports')
})

module.exports = router