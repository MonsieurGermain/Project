const UserModel = require('../../models/user');
const Product = require('../../models/product');
const Review = require('../../models/review');
const { sanitizeHTML, paginatedResults } = require('../../middlewares/function');

const profile = async (req, res) => {
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
};

module.exports = { profile };
