const { ORDER_STATUS } = require('../../constants/orderStatus');
const { OrderModel } = require('../../models/order');

const payOrder = async (req, res) => {
  try {
    const { user } = req;

    const order = await OrderModel.findById(req.params.id);
    order.isBuyer(user.username);

    if (order.orderStatus !== ORDER_STATUS.AWAITING_PAYMENT) {
      throw Error('Invalid Order Status');
    }

    res.render('pay', { order });
  } catch (e) {
    res.redirect('/404');
  }
};

module.exports = { payOrder };
