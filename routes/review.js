const express = require('express');
const router = express.Router();
const {Need_Authentification} = require('../middlewares/authentication');
const Review = require('../models/review');
const User = require('../models/user');
const Order = require('../models/order');
const Product = require('../models/product');
const {Validate_Reviews, FetchData, isOrder_Buyer} = require('../middlewares/validation');
const {Format_Username_Settings} = require('../middlewares/function');

function updateRating(review, note) {
   review.number_review += 1;
   review.total_note += note;
   review.average_note = review.total_note / review.number_review;
   return review;
}

router.post('/create-review/:id', Need_Authentification, FetchData(['params', 'id'], Order, undefined, 'order'), isOrder_Buyer, Validate_Reviews, async (req, res) => {
   const {order} = req;
   const {username} = req.user;
   const {note, type} = req;

   const review = new Review({
      product_slug: order.product_slug,
      vendor: order.vendor,
      sender: Format_Username_Settings(username, type),
      content: req.body.review,
      note,
      type,
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
});

module.exports = router;
