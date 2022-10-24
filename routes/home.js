const express = require('express');

const router = express.Router();
// const sendNotification = require('../middlewares/sendNotification');

router.get('/', async (req, res) => {
  try {
    // if (req.user) {
    //   sendNotification({
    //     userId: req.user.id,
    //     notificationType: 'newMessage',
    //     notificationData: ['Username', 'CONEVRSATION ID', 'MESSAGE'],
    //   });
    // }

    res.render('Pages/docsErrorPages/home');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

module.exports = router;
