const mongoose = require('mongoose');
const User = require('./user');

const reviewSchema = new mongoose.Schema({
  product_slug: {
    type: String,
    required: true,
  },
  vendor: {
    type: String,
    required: true,
  },
  sender: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  note: {
    type: Number,
    required: true,
  },
});

reviewSchema.methods.Get_Reviewer_Profile_Pic = async function () {
  let user;
  switch (this.type) {
    case 'default':
      user = await User.findOne({ username: this.sender });
      this.img_path = user.img_path;
      break;
    default:
      this.img_path = '/default/default-profile-pic.png';
  }
  return this;
};

reviewSchema.methods.changeReviewProductSlug = async function (newSlug) {
  this.product_slug = newSlug;
  await this.save();
};

reviewSchema.methods.deleteReview = async function () {
  await this.delete();
};

module.exports = mongoose.model('Review', reviewSchema);
