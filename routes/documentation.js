const express = require('express');

const router = express.Router();
const Contactus = require('../models/contactus');
const { validateContactUs } = require('../middlewares/validation');

// User Docs
router.get('/news', async (req, res) => {
  res.render('Pages/docsErrorPages/news');
});
router.get('/docs', async (req, res) => {
  res.render('Pages/docsErrorPages/documentation');
});
router.get('/contactus', async (req, res) => {
  res.render('Pages/docsErrorPages/contactUs');
});
router.post('/contactus', validateContactUs, async (req, res) => {
  try {
    const {
      username, email, message, reason,
    } = req.body;

    const contactUs = new Contactus({
      username: username && req.user.username ? req.user.username : undefined,
      email,
      message,
      reason,
    });

    contactUs.save();

    req.flash('success', 'Message Successfully Sent');
    res.redirect('/contactus');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

module.exports = router;
