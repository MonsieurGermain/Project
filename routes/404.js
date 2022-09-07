const express = require('express')
const router = express.Router()

router.get('/404', async (req,res) => {
    res.render('404page')
})

module.exports = router