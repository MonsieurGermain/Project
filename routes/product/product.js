const UserModel = require('../../models/user');
const Product = require('../../models/product');
const Review = require('../../models/review');

const { sanitizeHTML, paginatedResults, timerEndOfSales } = require('../../middlewares/function');

const productPage = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });

    if (product.status === 'offline' && product.vendor !== req.user.username) throw new Error('Product Offline');

    const vendor = await UserModel.findOne({ username: product.vendor });

    const paginatedReviews = await paginatedResults(
      Review,
      { product_slug: product.slug },
      { page: req.query.reviewPage },
    );

    product.description = sanitizeHTML(product.description);
    product.timerEndSales = timerEndOfSales(product.sales_end);

    res.render('Pages/productPages/product', { product, vendor, paginatedReviews });
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
};

module.exports = { product: productPage };
