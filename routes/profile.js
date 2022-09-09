const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Conversation = require('../models/conversation');
const Product = require('../models/product');
const Review = require('../models/review');
const {copyFile} = require('fs');
const {Need_Authentification} = require('../middlewares/authentication');
const {Validate_Profile} = require('../middlewares/validation');
const {uploadUserImg, deleteImage, sanitizeHTML, paginatedResults, sanitizeParams} = require('../middlewares/function');

// Route
router.get('/profile/:username', async (req, res) => {
   try {
      sanitizeParams(req.params.username)

      const vendor = await User.findOne({username: req.params.username}).orFail('This User doesnt Exist')
      vendor.description = sanitizeHTML(vendor.description);

      const productQuery = req.user && req.params.username === req.user.username ? {vendor: vendor.username} : {vendor: vendor.username, status: 'online'};
      const paginatedProducts = await paginatedResults(Product, productQuery, {page: req.query.productPage});
      const paginatedReviews = await paginatedResults(Review, {vendor: vendor.username}, {page: req.query.reviewPage});

      res.render('profile', {vendor, paginatedProducts, paginatedReviews});
   } catch (e) {
      console.log(e.message);
      res.redirect('/404');
   }
});

router.get('/edit-profile', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const paginatedProducts = await paginatedResults(Product, {vendor: user.username}, {page: req.query.productPage});

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

      res.render('profile-edit', {vendor: user, reviews, paginatedProducts});
   } catch (e) {
      res.redirect('/404');
   }
});

async function updateConversationImg_Path(username, newImgPath) {
   const conversations = await Conversation.findAllUserConversations(username);

   for (let i = 0; i < conversations.length; i++) {
      conversations[i].updateNewImgPath(username, newImgPath);
   }
}

router.put('/edit-profile', Need_Authentification, uploadUserImg.single('profileImg'), Validate_Profile, async (req, res) => {
   try {
      const {user} = req;
      const {job, description, achievement, languages} = req.body;

      if (req.file) {
         user.UploadImg(req.file);
         updateConversationImg_Path(user.username, user.img_path);
      }

      user.job = job;
      user.description = description;
      user.achievement = achievement;
      user.languages = languages;
      await user.save();

      req.flash('success', 'Profile Successfully Edited');
      res.redirect(`/profile/${user.username}?productPage=1&reviewPage=1`);
   } catch (e) {
      console.log(e);
      res.redirect(`/404`);
   }
}); 

router.get('/reset-profile-picture', Need_Authentification, async (req, res) => {
   try {
      const {user} = req

      deleteImage(`./public/${user.img_path}`);

      user.img_path = `/uploads/user-img/${user.username}.png`;

      copyFile('./public/default/default-profile-pic.png', `./public${user.img_path}`, (err) => {
         if (err) throw err;
      });

      await user.save()

      req.flash('success', 'Profile Picture Successfully Reseted');
      res.redirect(`/edit-profile?productPage=1&reviewPage=1`);
   } catch (e) {
      console.log(e);
      res.redirect(`/404`);
   }
});


// Where to put that
router.post('/awaiting-promotion', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;

      if (user.authorization !== 'buyer') throw new Error('You are already a Vendor')

      user.awaiting_promotion = true;

      user.save();

      req.flash('success', 'You submission to become a Vendor as been send');
      res.redirect(`/profile/${user.username}?productPage=1&reviewPage=1`);
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`);
   }
});

module.exports = router;
