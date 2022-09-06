const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Conversation = require('../models/conversation');
const Product = require('../models/product');
const Review = require('../models/review');
const {Need_Authentification, isBuyer} = require('../middlewares/authentication');
const {Validate_Profile, FetchData, paramsUsername_isReqUsername} = require('../middlewares/validation');
const {uploadUserImg, sanitizeHTML, paginatedResults} = require('../middlewares/function');

// Route
router.get('/profile/:username', FetchData(['params', 'username'], User, 'username', 'vendor'), async (req, res) => {
   try {
      const {vendor} = req;
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

router.get('/edit-profile/:username', Need_Authentification, paramsUsername_isReqUsername, async (req, res) => {
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

router.put('/edit-profile/:username', Need_Authentification, paramsUsername_isReqUsername, uploadUserImg.single('profileImg'), Validate_Profile, async (req, res) => {
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

// Where to put that
router.post('/awaiting-promotion', Need_Authentification, isBuyer, async (req, res) => {
   try {
      const {user} = req;

      user.awaiting_promotion = true;

      user.save();

      req.flash('success', 'You submission to become a Vendor as been send');
      res.redirect(`/profile/${user.username}?productPage=1&reviewPage=1`);
   } catch (e) {
      res.redirect('/404');
   }
});

module.exports = router;
