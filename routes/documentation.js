const express = require('express')
const router = express.Router()


router.get('/docs', async (req,res) => {
    res.render('documentation')
})


module.exports = router