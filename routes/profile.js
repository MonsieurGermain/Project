const express = require('express');

const router = express.Router();
const { copyFile } = require('fs');
const fileUpload = require('express-fileupload');
const UserModel = require('../models/user');
const Product = require('../models/product');
const Review = require('../models/review');
const { ImageUploadsValidation, uploadsFiles } = require('../middlewares/filesUploads');
const { isAuth } = require('../middlewares/authentication');
const { sanitizeProfileInput, sanitizeQuerys, sanitizeParamsQuerys } = require('../middlewares/validation');
const { sanitizeHTML, paginatedResults } = require('../middlewares/function');

// Route

router.get('/user/profile/edit', isAuth, sanitizeQuerys, async (req, res) => {
  try {
    const { user } = req;
    const paginatedProducts = await paginatedResults(
      Product,
      { vendor: user.username },
      { page: req.query.productPage },
    );

    const reviews = [
      {
        sender: 'Dummy Username',
        content: 'Wow This Product was Amazing !',
        type: 'default',
        note: 5,
        __v: 0,
      },
      {
        sender: 'Dummy Username',
        content: 'The shipping was a bit slow, but the product itself is really cool.',
        type: 'default',
        note: 4,
        __v: 0,
      },
      {
        sender: 'Dummy Username',
        content: 'Will definetly buy again',
        type: 'default',
        note: 5,
        __v: 0,
      },
      {
        sender: 'Dummy Username',
        content: 'The Product arrived broken :(, luckely, the vendor was kind enough to send me another one',
        type: 'default',
        note: 4,
        __v: 0,
      },
      {
        sender: 'Dummy Username',
        content: 'Great I like it !',
        type: 'default',
        note: 5,
        __v: 0,
      },
    ];

    res.render('Pages/profilePages/editProfile', { vendor: user, reviews, paginatedProducts });
  } catch (e) {
    res.redirect('/404');
  }
});

router.get('/user/profile/:username', sanitizeParamsQuerys, async (req, res) => {
  try {
    const vendor = await UserModel.findOne({ username: req.params.username }).orFail('This User doesnt Exist');
    vendor.description = sanitizeHTML(vendor.description);

    const productQuery = req.user?.username === req.params.username ? { vendor: vendor.username } : { vendor: vendor.username, status: 'online' };
    const paginatedProducts = await paginatedResults(Product, productQuery, { page: req.query.productPage });

    const paginatedReviews = await paginatedResults(
      Review,
      { vendor: vendor.username },
      { page: req.query.reviewPage },
    );

    res.render('Pages/profilePages/profile', { vendor, paginatedProducts, paginatedReviews });
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.put(
  '/edit-profile',
  isAuth,
  fileUpload({ createParentPath: true }),
  ImageUploadsValidation({ max: 1, errorUrl: '/user/profile/edit' }),
  sanitizeProfileInput,
  async (req, res) => {
    try {
      const { user } = req;
      const {
        profileImg, job, description, achievement, languages,
      } = req.body;

      if (profileImg) user.img_path = uploadsFiles(profileImg, `./uploads${user.img_path}`, false);

      user.job = job;
      user.description = description;
      user.achievement = achievement;
      user.languages = languages;

      await user.save();

      req.flash('success', 'Profile Successfully Edited');
      res.redirect(`/user/profile/${user.username}?productPage=1&reviewPage=1`);
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);

router.get('/reset-profile-picture', isAuth, async (req, res) => {
  try {
    const { user } = req;

    copyFile('./public/default/default-profile-pic.png', `./uploads/${user.img_path}`, (err) => {
      if (err) throw err;
    });

    await user.save();

    req.flash('success', 'Profile Picture Successfully Reseted');
    res.redirect('/user/profile/edit?productPage=1&reviewPage=1');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

// Where to put that
router.post('/awaiting-promotion', isAuth, async (req, res) => {
  try {
    const { user } = req;

    if (user.authorization !== 'buyer') throw new Error('You are already a Vendor');

    user.awaiting_promotion = true;

    user.save();

    req.flash('success', 'You submission to become a Vendor as been send');
    res.redirect(`/user/${user.username}?productPage=1&reviewPage=1`);
  } catch (e) {
    req.flash('error', e.message);
    res.redirect(`/user/profile/${req.user.username}?productPage=1&reviewPage=1`);
  }
});

module.exports = router;
