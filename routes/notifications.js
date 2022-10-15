const express = require('express');

const router = express.Router();
const Notification = require('../models/notification');
const { isAuth } = require('../middlewares/authentication');
const { sanitizeQuerys } = require('../middlewares/validation');
const { paginatedResults } = require('../middlewares/function');

router.get('/notification', isAuth, sanitizeQuerys, async (req, res) => {
  try {
    const { user } = req;

    const notifications = await paginatedResults(Notification, { userId: user.id }, { page: req.query.notificationPage, limit: 24 });

    res.render('notification', { notifications });
  } catch (e) {
    console.log(e);
    res.redirect('/');
  }
});

module.exports = router;
