const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const passport = require('passport');
const User = require('../models/user');
const StepVerification = require('../models/2step-verification');
const fs = require('fs');
const {Should_Not_Be_Authenticated} = require('../middlewares/authentication');
const {Validate_Login, Validate_Register, Validate_Code} = require('../middlewares/validation');
const {generateRandomString, RandomList_ofWords} = require('../middlewares/function');


function generateWordsUsername() {
   let result = '';

   while(!result.length) {
      for(let i = 0; i < 4; i++) {
         result += ` ${RandomList_ofWords(1)}`
      }
      if (result.length > 25) result = '';
   }

   return result.trim();
}
function generateNumberUsername() {
   let result = '';
   for(let i = 0; i < 4; i++) {
      result += ` ${generateRandomString(4)}`
   }
   return result.trim();
}
function generateAccountUsername(usernameType) {
   switch(usernameType) {
      case 'words':
         return generateWordsUsername()
      case 'characters':
         return generateNumberUsername()
   }
   throw new Error('Invalid Type of Username')
}
function generateAccountPassword(passwordType, typedPassword) {
   switch(passwordType) {
      case 'generate-password':
         return generateRandomString(20)
      case 'choose-password':
         if (!typedPassword || typeof(typedPassword) !== 'string') throw new Error('The Password fields is Required')
         typedPassword = typedPassword.trim()
         if (typedPassword.length < 8 || typedPassword.length > 200) throw new Error('The Password need to be within 8 to 200 characters longs')
         return typedPassword
   }
   throw new Error('Invalid Type of Password')
}


function createProfilePicture(username) {
   const img_path = `/uploads/user-img/${username}.png`;

   fs.copyFile('./public/default/default-profile-pic.png', `./public${img_path}`, (err) => {
      if (err) throw err;
   });

   return img_path;
}
async function create2StepVerification(username, stepVerificationSettings) {
   await StepVerification.deleteMany({ username: username });

   const stepVerification = new StepVerification({});
   stepVerification.username = username;
   stepVerification.type = stepVerificationSettings;
   stepVerification.code = stepVerificationSettings === 'email' ? generateRandomString(9, 'number') : RandomList_ofWords(12);
   stepVerification.encrypted_code = stepVerificationSettings === 'email' ? undefined : stepVerification.code;

   const redirectUrl = stepVerificationSettings === 'email' ? `/2fa?type=${stepVerificationSettings}` : `/2fa?type=${stepVerificationSettings}&encrypted=${stepVerification.encrypted_code}`

   await stepVerification.save();

   return redirectUrl;
}

router.get('/login', Should_Not_Be_Authenticated, (req, res) => {
   res.render('login');
});

router.post('/login', Should_Not_Be_Authenticated, Validate_Login,
   async (req, res, next) => {
      try {
         const {username, password} = req.body;

         const user = await User.findOne({username: username})

         if (!user) throw new Error('Username or Password Invalid')
         if (!bcrypt.compareSync(password, user.password)) throw new Error('Username or Password Invalid');

         if (user.settings.userExpiring) user.updateInactiveDate();
         user.save();

         if (user.settings.step_verification) {
            const redirectUrl = await create2StepVerification(user.username, user.settings.step_verification);
            res.redirect(redirectUrl);
         } else {
            req.user_toAuth = user;
            next();
         }
      } catch (e) {
         console.log(e);
         req.flash('error', e.message);
         res.redirect('/login');
      }
   }, passport.authenticate('local', {
      failureRedirect: '/login',
      failureFlash: true,
   }), (req, res) => {
      if (req.user.authorization === 'admin') res.redirect('/disputes');
      else res.redirect('/');
   }
);

router.get('/2fa', Should_Not_Be_Authenticated, async (req, res) => {
   try {
      res.render('2fa');
   } catch (e) {
      console.log(e);
      req.flash('error', 'An Error as occur Please Try Again');
      res.redirect('/login');
   }
});

router.post('/2fa', Should_Not_Be_Authenticated, Validate_Code,
   async (req, res, next) => {
      try {
         const stepVerification = await StepVerification.findOne({ code: req.body.code }).orFail(new Error('Oops... Code Invalid, try Again'));

         req.user_toAuth = stepVerification.username;
         // Provent Passport Missing credentials Error
         req.body.username = 'username';
         req.body.password = 'password';

         stepVerification.deleteStepVerification();

         next();
      } catch (e) {
         const query = req.query.encrypted ? `type=${req.query.type}&encrypted=${req.query.encrypted}` : `type=${req.query.type}`;

         req.flash('error', e.message);
         res.redirect(`/2fa?${query}`);
      }
   }, passport.authenticate('local', {
      failureRedirect: `/login`,
      failureFlash: true,
   }), (req, res) => {
      if (req.user.authorization === 'admin') res.redirect('/disputes');
      else res.redirect('/');
   }
);

router.get('/register', Should_Not_Be_Authenticated, (req, res) => {
   res.render('register');
});

router.post('/register', Should_Not_Be_Authenticated, Validate_Register, async (req, res) => {
   try {
      let {username, password} = req.body;

      const isUsernameTaken = await User.findOne({username: username})
      if (isUsernameTaken) throw new Error('This Username is Already Taken')

      const user = new User({
         username,
         password: bcrypt.hashSync(password, 11),
         img_path: createProfilePicture(username),
      });

      await user.save();

      req.flash('success', 'Account Successfully Created');
      res.redirect('/login');
   } catch (e) {
      req.flash('error', e.message)
      res.redirect('/register');
   }
});


router.get('/generate-account', Should_Not_Be_Authenticated, async (req, res) => {
   try {
      res.render('generate-account')
   } catch (e) {
      console.log(e)
      req.flash('error', 'Unexpected Error, try again')
      res.redirect('/register');
   }
})
router.post('/generate-account', Should_Not_Be_Authenticated, async (req, res) => {
   try {
      let {usernameSettings, passwordSettings, password} = req.body

      const user = new User({})

      user.username = generateAccountUsername(usernameSettings)

      const isUsernameTaken = await User.findOne({username: user.username})
      if (isUsernameTaken) throw new Error('This Username is Already Taken')
      
      let userPassword = generateAccountPassword(passwordSettings, password)
      user.password = bcrypt.hashSync(userPassword , 11),

      user.img_path = createProfilePicture(user.username),
      user.settings.userExpiring = 14

      await user.save()      

      req.flash('success', `
      <p class="mb-0">Account Username: <b>${user.username}</b></p>
      <p class="mb-0">Password: <b>${userPassword}</b></p>
      `);
      res.redirect('/login');
   } catch (e) {
      console.log(e)
      req.flash('error', e.message)
      res.redirect('/generate-account');
   }
})

// Redirect to /
router.get('/logout', (req, res) => {
   req.logOut();
   res.redirect('/login');
});

module.exports = router;
