const express = require('express');
const router = express.Router();
const {Need_Authentification} = require('../middlewares/authentication');
const Review = require('../models/review');
const User = require('../models/user');
const Order = require('../models/order');
const Product = require('../models/product');
const {Validate_Reviews} = require('../middlewares/validation');
const {formatUsernameWithSettings, sanitizeParams} = require('../middlewares/function');

function updateRating(review, note) {
   review.number_review += 1;
   review.total_note += note;
   review.average_note = review.total_note / review.number_review;
   return review;
}

router.post('/create-review/:id', Need_Authentification, Validate_Reviews, async (req, res) => {
   try {
      sanitizeParams(req.params.id)

      const {username} = req.user,
            {note, type} = req.body;
   
      const order = await Order.findByIdwhereYouBuyer(req.params.id, username)
   
      const review = new Review({
         product_slug: order.product_slug,
         vendor: order.vendor,
         sender: formatUsernameWithSettings(username, type),
         content: req.body.review,
         note,
      });
   
      order.let_review = true;
   
      let product = await Product.findOne({slug: order.product_slug});
      product.review = updateRating(product.review, note);
   
      let user = await User.findOne({username: order.vendor});
      user.review = updateRating(user.review, note);
   
      user.save();
      product.save();
      review.save();
      await order.save();
   
      res.redirect(`/order-resume/${req.params.id}`);
   } catch(e) {
      console.log(e)
      res.redirect('/404')
   }
});

module.exports = router;
