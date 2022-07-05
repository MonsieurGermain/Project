const express = require('express')
const router = express.Router()


router.get('/news', async (req,res) => {
    res.render('news')
})


module.exports = router