const express = require('express');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    res.render('Pages/docsErrorPages/home');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

module.exports = router;
