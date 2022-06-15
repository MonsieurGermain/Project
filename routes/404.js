const express = require('express')
const router = express.Router()

router.get('/404', async (req,res) => {
    res.render('404page')
})

router.get('/error', async (req,res) => {
    res.render('something-wrong')
})

module.exports = router