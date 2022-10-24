const Fuse = require('fuse.js');
const Product = require('../../models/product');
const { paginatedResults } = require('../../middlewares/function');

// Create Fuzzy Product Collecion
let fusedProduct = Product.find({ status: 'online' }).then((products) => {
  const options = {
    threshold: 0.5,
    keys: ['title', 'vendor'],
  };
  fusedProduct = new Fuse(products, options);
});
  // Update Fuzzy Product Collecion
setInterval(() => {
  Product.find({ status: 'online' }).then((products) => {
    const options = {
      threshold: 0.4,
      keys: ['title', 'vendor'],
    };
    fusedProduct = new Fuse(products, options);
  });
}, 2 * 60 * 1000); // 2min

const products = async (req, res) => {
  try {
    let productsFuzzy;

    const { search, productPage } = req.query;

    if (search) {
      const productFused = fusedProduct.search(search);
      productsFuzzy = productFused.map(({ item }) => item);
    }
    const paginatedProducts = await paginatedResults(
      Product,
      { status: 'online' },
      { page: productPage, limit: 24 },
      productsFuzzy,
    );

    res.render('Pages/productPages/products', { paginatedProducts });
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
};

module.exports = { products };
