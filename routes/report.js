const express = require('express')
const router = express.Router()
const Report = require('../models/report')
const { Need_Authentification } = require('../middlewares/authentication')



router.post('/report/:id', Need_Authentification,
async (req,res) => {
    const report = new Report({
        reference_id : req.params.id,
        reason : req.body.reason !== 'other' ? req.body.reason : req.body.other,
        type : req.query.type,
        explaination : req.body.explaination 
    })

    report.save()
    res.redirect(req.query.url)
})


module.exports = router