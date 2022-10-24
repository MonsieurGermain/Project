const express = require('express');

const router = express.Router();
const bcrypt = require('bcrypt');
const passport = require('passport');
const { copyFile } = require('fs');
const UserModel = require('../models/user');
const StepVerification = require('../models/2step-verification');
const { generateRandomName } = require('../middlewares/filesUploads');
const { isntAuth } = require('../middlewares/authentication');
const { sanitizeLoginInput, sanitizeRegisterInput, sanitizeVerificationCode } = require('../middlewares/validation');
const { generateRandomString, randomListOfWords, generateAccountUsername } = require('../middlewares/function');
const { send2FACode, encrypt } = require('../utils');

function generateAccountDetailsFlashMessage(username, password) {
  return `
   <p class="mb-0">Account Username: <b>${username}</b></p>
   <p class="mb-0">Password: <b>${password}</b></p>
   <p class="fs-xs mb-0"> <b>Save this somewhere safe</b></p>
   `;
}

function generateAccountPassword(passwordType, typedPassword) {
  switch (passwordType) {
    case 'generate-password':
      return generateRandomString(24);
    case 'choose-password':
      if (!typedPassword || typeof typedPassword !== 'string') throw new Error('The Password fields is Required');
      typedPassword = typedPassword.trim();
      if (typedPassword.length < 8 || typedPassword.length > 200) {
        throw new Error(
          'The Password need to be within 8 to 200 characters longs',
        );
      }
      return typedPassword;
  }
}

function createProfilePicture(name) {
  const randomImgName = generateRandomName(name, 17);
  const imgPath = `/userImg/${randomImgName}`;

  copyFile(
    './public/default/default-profile-pic.png',
    `./uploads${imgPath}`,
    (err) => {
      if (err) throw err;
    },
  );

  return imgPath;
}

async function create2StepVerification(
  username,
  type,
  { email, pgpPublicKey },
) {
  await StepVerification.deleteMany({ username });

  if (type === 'email') {
    const code = generateRandomString(9, 'number');

    const stepVerification = new StepVerification({
      username,
      type,
      code,
    });
    await stepVerification.save();

    send2FACode(email, code).catch((err) => {
      console.log('Failed to send mail', err);
    });

    return `/2fa?type=${type}`;
  }

  const code = randomListOfWords(12);
  const encryptedCode = await encrypt(pgpPublicKey, code);

  const stepVerification = new StepVerification({
    username,
    type,
    code,
    encrypted_code: Buffer.from(encryptedCode).toString('base64'),
  });

  await stepVerification.save();

  return `/2fa?type=${type}&encrypted=${stepVerification.encrypted_code}`;
}

router.get('/login', isntAuth, (req, res) => {
  res.render('Pages/authPages/login');
});

router.post(
  '/login',
  isntAuth,
  sanitizeLoginInput,
  async (req, res, next) => {
    try {
      const { username, password } = req.body;

      const user = await UserModel.findOne({ username });

      if (!user) throw new Error('Username or Password Invalid');
      if (!bcrypt.compareSync(password, user.password)) throw new Error('Username or Password Invalid');

      user.settings.userExpiring ? user.updateInactiveDate() : undefined;
      await user.save();

      if (user.settings.step_verification) {
        res.redirect(
          await create2StepVerification(
            user.username,
            user.settings.step_verification,
            { email: user.email, pgpPublicKey: user.verifiedPgpKeys },
          ),
        );
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
    failureRedirect: '/login',
    failureFlash: true,
  }),
  (req, res) => {
    if (req.user.authorization !== 'admin') res.redirect('/');
    else res.redirect('/disputes?disputesPage=1');
  },
);

router.get('/2fa', isntAuth, async (req, res) => {
  try {
    res.render('Pages/authPages/stepVerification');
  } catch (e) {
    console.log(e);
    req.flash('error', 'An Error as occur Please Try Again');
    res.redirect('/login');
  }
});

router.post(
  '/2fa',
  isntAuth,
  sanitizeVerificationCode,
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
      req.flash('error', e.message);
      res.redirect(
        `/2fa?type=${req.query.type}${req.query.encrypted ? `&encrypted=${req.query.encrypted}` : ''
        }`,
      );
    }
  },
  passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: true,
  }),
  (req, res) => {
    if (req.user.authorization === 'admin') res.redirect('/disputes?disputesPage=1');
    else res.redirect('/');
  },
);

router.get('/register', isntAuth, (req, res) => {
  res.render('Pages/authPages/register');
});

router.post('/register', isntAuth, sanitizeRegisterInput, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (await UserModel.findOne({ username })) throw new Error('This Username is Already Taken');

    const user = new UserModel({
      username,
      password: bcrypt.hashSync(password, 12),
      img_path: createProfilePicture('default-profile-pic.png'),
    });

    await user.save();

    req.flash('success', 'Account Successfully Created');
    res.redirect('/login');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/register');
  }
});

router.get('/generate-account', isntAuth, async (req, res) => {
  try {
    res.render('Pages/authPages/generateAccount');
  } catch (e) {
    console.log(e);
    req.flash('error', 'Unexpected Error, try again');
    res.redirect('/register');
  }
});
router.post('/generate-account', isntAuth, async (req, res) => {
  try {
    const { passwordSettings, password } = req.body;

    const username = generateAccountUsername();

    if (await UserModel.findOne({ username })) throw new Error('This Username is Already Taken');

    const userPassword = generateAccountPassword(passwordSettings, password);

    const user = new UserModel({
      username: generateAccountUsername(),
      password: bcrypt.hashSync(userPassword, 12),
      img_path: createProfilePicture(username),
      settings: {
        userExpiring: 14,
        messageExpiring: 7,
        privateInfoExpiring: 7,
        deleteEmptyConversation: true,
        recordSeeingMessage: false,
      },
    });

    await user.save();

    req.flash(
      'success',
      generateAccountDetailsFlashMessage(user.username, userPassword),
    );
    res.redirect('/login');
  } catch (e) {
    console.log(e);
    req.flash('error', e.message);
    res.redirect('/generate-account');
  }
});

router.get('/logout', (req, res) => {
  delete req.session.hiddenConversationsId;

  req.logOut();
  res.redirect('/');
});

module.exports = router;
