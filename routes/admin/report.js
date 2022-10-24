const UserModel = require('../../models/user');
const Product = require('../../models/product');
const Report = require('../../models/report');

const report = async (req, res) => {
  try {
    if (!['vendor', 'product'].includes(req.query.type)) throw new Error('Invalid type to report');

    req.query.type === 'vendor'
      ? await UserModel.findOne({ username: req.params.id }).orFail(new Error())
      : await Product.findOne({ slug: req.params.id }).orFail(new Error()); // Check if the Object that is being reported Exists

    const { type, url } = req.query;
    const { id } = req.params;
    const { reason, username, message } = req.body;

    const newReport = new Report({
      reference_id: id,
      type,
      username,
      message,
      reason,
    });

    newReport.save();

    req.flash(
      'success',
      'Thank you for your Report, we are now Investigating',
    );
    res.redirect(url);
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
};

module.exports = { report };
