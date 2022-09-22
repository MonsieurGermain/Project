const express = require('express');
const router = express.Router(); 

const User = require('../models/user') 

router.get('/', async (req, res) => {
   try { 
      const user = await User.findOne({username: 'Username'}, '-_id username')

      console.log(user)

      res.render('home');
   } catch (e) {
      console.log(e)
      res.redirect('/404')
   }
});

module.exports = router;
