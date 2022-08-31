const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const passport = require('passport');
const User = require('../models/user');
const StepVerification = require('../models/2step-verification');
const fs = require('fs');
const {Should_Not_Be_Authenticated} = require('../middlewares/authentication');
const {ValidateValueByChoice, Validate_Login, Validate_Register, Is_UsernameTaken, Validate_Code, Validate_EncryptedCodeQuery} = require('../middlewares/validation');
const {RandomNumber, RandomList_ofWords} = require('../middlewares/function');

function Create_Profile_Pic(username) {
   const img_path = `/uploads/user-img/${username}.png`;

   fs.copyFile('./public/default/default-profile-pic.png', `./public${img_path}`, (err) => {
      if (err) throw err;
   });
   return img_path;
}

async function Create_2StepVerification(user) {
   const Already_hasStepVerification = await StepVerification.findOne({
      username: user.username,
   });
   if (Already_hasStepVerification) await Already_hasStepVerification.deleteStepVerification();

   const stepVerification = new StepVerification({});
   stepVerification.username = user.username;
   stepVerification.type = user.settings.step_verification;

   let query;
   if (stepVerification.type === 'email') {
      query = `/2fa?type=${user.settings.step_verification}`;
      stepVerification.code = RandomNumber(9);
   } else {
      stepVerification.code = RandomList_ofWords(12);
      stepVerification.encrypted_code = stepVerification.code;
      query = `/2fa?type=${user.settings.step_verification}&encrypted=${stepVerification.encrypted_code}`;
   }

   await stepVerification.save();

   return query;
}

router.get('/login', Should_Not_Be_Authenticated, (req, res) => {
   res.render('login');
});

router.post(
   '/login',
   Should_Not_Be_Authenticated,
   Validate_Login,
   async (req, res, next) => {
      try {
         const {username, password} = req.body;

         const user = await User.findOne({username: username}).orFail(new Error('Username or Password Invalid'));

         if (!bcrypt.compareSync(password, user.password)) throw new Error('Username or Password Invalid');

         user.Update_IncativeDate();
         await user.save();

         if (user.settings.step_verification) {
            const query = await Create_2StepVerification(user);
            res.redirect(query);
         } else {
            req.user_toAuth = user;
            next();
         }
      } catch (e) {
         console.log(e);
         req.flash('error', e.message);
         res.redirect('/login');
      }
   },
   passport.authenticate('local', {
      failureRedirect: `/login`,
      failureFlash: true,
   }),
   (req, res) => {
      if (req.user.authorization === 'admin') res.redirect('/disputes');
      else res.redirect('/');
   }
);

router.get('/2fa', Should_Not_Be_Authenticated, ValidateValueByChoice(['query', 'type'], ['email', 'pgp']), Validate_EncryptedCodeQuery, async (req, res) => {
   try {
      res.render('2fa');
   } catch (e) {
      console.log(e);
      req.flash('error', 'An Error as occur Please Try Again');
      res.redirect('/login');
   }
});

router.post(
   '/2fa',
   Should_Not_Be_Authenticated,
   ValidateValueByChoice(['query', 'type'], ['email', 'pgp']),
   Validate_EncryptedCodeQuery,
   Validate_Code,
   async (req, res, next) => {
      try {
         const stepVerification = await StepVerification.findOne({
            code: req.body.code,
         }).orFail(new Error('Oops... Code Invalid, try Again'));

         req.user_toAuth = stepVerification.username;
         // Provent Passport Missing credentials Error
         req.body.username = 'username';
         req.body.password = 'password';

         stepVerification.deleteStepVerification();

         next();
      } catch (e) {
         console.log(e);
         req.flash('error', e.message);
         const query = req.query.encrypted ? `type=${req.query.type}&encrypted=${req.query.encrypted}` : `type=${req.query.type}`;
         res.redirect(`/2fa?${query}`);
      }
   },
   passport.authenticate('local', {
      failureRedirect: `/login`,
      failureFlash: true,
   }),
   (req, res) => {
      if (req.user.authorization === 'admin') res.redirect('/disputes');
      else res.redirect('/');
   }
);

router.get('/register', Should_Not_Be_Authenticated, (req, res) => {
   res.render('register', {user: null});
});

router.post('/register', Should_Not_Be_Authenticated, Validate_Register, Is_UsernameTaken, async (req, res) => {
   try {
      let {username, password} = req.body;

      const user = new User({
         username,
         password: await bcrypt.hash(password, 11), //Hash Passw
         img_path: Create_Profile_Pic(username),
      });

      await user.save();

      req.flash('success', 'Account Successfully Created');
      res.redirect('/login');
   } catch (err) {
      console.log(err);
      res.render('register', {user: null});
      return;
   }
});

// Redirect to /
router.get('/logout', (req, res) => {
   req.logOut();
   res.redirect('/login');
});

module.exports = router;
