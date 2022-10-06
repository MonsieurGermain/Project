const express = require('express');

const router = express.Router();
const User = require('../models/user');
const { OrderModel } = require('../models/order');
const Report = require('../models/report');
const Product = require('../models/product');
const Contactus = require('../models/contactus');
const { isAuth } = require('../middlewares/authentication');
const {
  validateReports,
  validateResolveReport,
  sanitizeParams,
  sanitizeQuerys,
  sanitizeParamsQuerys,
} = require('../middlewares/validation');
const {
  formatUsernameWithSettings,
  paginatedResults,
} = require('../middlewares/function');

async function getResolveReportDocuments(type, id) {
  let user;
  let product;
  switch (type) {
    case 'vendor':
      user = await User.findOne({ username: id });
      break;
    case 'product':
      product = await Product.findOne({ slug: id });
      user = await User.findOne({ username: product.vendor });
      break;
    default:
      throw new Error('Invalid Type');
  }
  return { user, product };
}

function hideBuyerUsername(disputes) {
  for (let i = 0; i < disputes.length; i++) {
    disputes[i].buyer = formatUsernameWithSettings(
      disputes[i].buyer,
      disputes[i].privacy,
    );
  }
  return disputes;
}

function constructQuery(query) {
  const mongooseQuery = {};
  if (query.reason) mongooseQuery.reason = query.reason;
  if (query.archived) mongooseQuery.archived = query.archived === 'true' ? { $exists: true } : { $exists: false };

  return mongooseQuery;
}

router.post(
  '/report/:id',
  isAuth,
  sanitizeParamsQuerys,
  validateReports,
  async (req, res, next) => {
    try {
      if (req.params.id === req.user.username) throw new Error('Why do you want to report Yourself ?');
      next();
    } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`);
    }
  },
  async (req, res) => {
    try {
      if (!['vendor', 'product'].includes(req.query.type)) throw new Error('Invalid type to report');

      req.query.type === 'vendor'
        ? await User.findOne({ username: req.params.id }).orFail(new Error())
        : await Product.findOne({ slug: req.params.id }).orFail(new Error()); // Check if the Object that is being reported Exists

      const { type, url } = req.query;
      const { id } = req.params;
      const { reason, username, message } = req.body;

      const report = new Report({
        reference_id: id,
        type,
        username,
        message,
        reason,
      });

      report.save();

      req.flash(
        'success',
        'Thank you for your Report, we are now Investigating',
      );
      res.redirect(url);
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);

// Admin Report
router.get(
  '/reports',
  isAuth,
  sanitizeQuerys, // isAdmin,
  async (req, res) => {
    try {
      if (
        ![undefined, 'scam', 'blackmail', 'information', 'other'].includes(
          req.query.reason,
        )
      ) throw new Error('Invalid type to report');
      if (![undefined, 'true', 'false'].includes(req.query.archived)) throw new Error('Invalid type to report');

      const query = constructQuery(req.query);
      query.ban_explanation = { $exists: false };

      const reports = await paginatedResults(Report, query, {
        page: req.query.reportsPage,
        limit: 24,
      });

      res.render('admin-reports', { reports });
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);
router.post(
  '/report-filter',
  isAuth,
  sanitizeQuerys, // isAdmin,
  async (req, res) => {
    try {
      const { reason, archived } = req.body;

      if (
        !['all', 'scam', 'blackmail', 'information', 'other'].includes(reason)
      ) {
        throw new Error('Invalid type to report');
      }

      if (!['all', 'true', 'false'].includes(archived)) {
        throw new Error('Invalid type to report');
      }

      res.redirect(
        `/reports?reportsPage=1${reason !== 'all' ? `&reason=${reason}` : ''}${
          archived !== 'all' ? `&archived=${archived}` : ''
        }`,
      );
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);
router.post(
  '/archive-report/:id',
  isAuth,
  sanitizeParamsQuerys, // isAdmin,
  async (req, res) => {
    try {
      const report = await Report.findById(req.params.id).orFail(new Error());

      report.archived = report.archived ? undefined : true;

      await report.save();

      req.flash('success', 'Report Successfully Archived/Unarchived');
      res.redirect(
        `/reports?reportsPage=${
          req.query.reportsPage ? req.query.reportsPage : '1'
        }${req.query.reason ? `&reason=${req.query.reason}` : ''}${
          req.query.archived ? `&archived=${req.query.archived}` : ''
        }`,
      );
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);
router.post(
  '/dismiss-report/:id',
  isAuth,
  sanitizeParamsQuerys, // isAdmin,
  async (req, res) => {
    try {
      const report = await Report.findById(req.params.id).orFail(new Error());

      await report.deleteReport();

      req.flash('success', 'Report Successfully Dismissed');
      res.redirect(
        `/reports?reportsPage=${
          req.query.reportsPage ? req.query.reportsPage : '1'
        }${req.query.reason ? `&reason=${req.query.reason}` : ''}${
          req.query.archived ? `&archived=${req.query.archived}` : ''
        }`,
      );
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);
router.post(
  '/resolve-report/:id',
  isAuth,
  sanitizeParamsQuerys, // isAdmin,
  validateResolveReport,
  async (req, res) => {
    try {
      const report = await Report.findById(req.params.id).orFail(new Error());

      const { banReason } = req.body; // Why Message ?

      const { user, product } = await getResolveReportDocuments(
        report.type,
        report.reference_id,
      );

      if (product) {
        product.status === 'offline';
        product.save();
      }

      user.warning += 1;

      if (user.warning >= 5) {
        user.deleteUser();
      } else user.save();

      let flashMessage = 'The Vendor as been given a warning';

      if (banReason) {
        report.ban_explanation = banReason;
        flashMessage = 'A request to ban this vendor as been made';
        await report.save();
      } else await report.deleteReport();

      // Send Message to Vendor

      req.flash('success', flashMessage);
      res.redirect(
        `/reports?reportsPage=${
          req.query.reportsPage ? req.query.reportsPage : '1'
        }${req.query.reason ? `&reason=${req.query.reason}` : ''}${
          req.query.archived ? `&archived=${req.query.archived}` : ''
        }`,
      );
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);

// Ban User
router.get(
  '/ban-user',
  isAuth,
  sanitizeQuerys, // isAdmin,
  async (req, res) => {
    try {
      if (
        ![undefined, 'scam', 'blackmail', 'information', 'other'].includes(
          req.query.reason,
        )
      ) {
        throw new Error('Invalid type to report');
      }

      const query = constructQuery(req.query);
      query.ban_explanation = { $exists: true };

      const reports = await paginatedResults(Report, query, {
        page: req.query.reportsPage,
        limit: 24,
      });

      res.render('admin-ban-user', { reports });
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);
router.post(
  '/ban-user-filter',
  isAuth,
  sanitizeQuerys, // isAdmin,
  async (req, res) => {
    try {
      const { reason, archived } = req.body;

      if (
        !['all', 'scam', 'blackmail', 'information', 'other'].includes(reason)
      ) {
        throw new Error('Invalid type to report');
      }

      if (!['all', 'true', 'false'].includes(archived)) {
        throw new Error('Invalid type to report');
      }

      res.redirect(
        `/ban-user?reportsPage=1${reason !== 'all' ? `&reason=${reason}` : ''}${
          archived !== 'all' ? `&archived=${archived}` : ''
        }`,
      );
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);
router.post(
  '/dismiss-ban-request/:id',
  isAuth,
  sanitizeParamsQuerys, // isAdmin,
  async (req, res) => {
    try {
      const report = await Report.findById(req.params.id).orFail(new Error());

      report.deleteReport();

      req.flash('success', 'Ban Request Successfully Dismissed');
      res.redirect(
        `/ban-user?reportsPage=${
          req.query.reportsPage ? req.query.reportsPage : '1'
        }${req.query.reason ? `&reason=${req.query.reason}` : ''}}`,
      );
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);
router.post(
  '/ban-user/:id',
  isAuth,
  sanitizeParamsQuerys, // isAdmin,
  async (req, res) => {
    try {
      const report = await Report.findById(req.params.id).orFail(new Error());

      const { user } = await getResolveReportDocuments(
        report.type,
        report.reference_id,
      );

      user.deleteUser();
      report.deleteReport();

      req.flash('success', 'User Successfully Banned');
      res.redirect(
        `/ban-user?reportsPage=${
          req.query.reportsPage ? req.query.reportsPage : '1'
        }${req.query.reason ? `&reason=${req.query.reason}` : ''}`,
      );
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);

// Disputes
router.get(
  '/disputes',
  isAuth,
  sanitizeQuerys, // isAdmin,
  async (req, res) => {
    try {
      const { adminDispute, reason } = req.query;

      const query = reason
        ? {
          orderStatus: 'DISPUTE_IN_PROGRESS',
          'disputesSettings.disputeReason': reason,
          'disputesSettings.disputeAdmin': adminDispute
            ? req.user.username
            : undefined,
        }
        : {
          orderStatus: 'DISPUTE_IN_PROGRESS',
          'disputesSettings.disputeAdmin': adminDispute
            ? req.user.username
            : undefined,
        };

      const disputes = await paginatedResults(OrderModel, query, {
        page: req.query.disputesPage,
        limit: 24,
        populate: 'product',
      });

      disputes.results = hideBuyerUsername(disputes.results);

      res.render('admin-dispute-list', { disputes });
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);
router.post(
  '/disputes-filter',
  isAuth,
  sanitizeParams, // isAdmin,
  async (req, res) => {
    try {
      if (
        !['all', 'Product Broken', 'Product Late', 'Other'].includes(
          req.body.reason,
        )
      ) throw Error('Invalid Reason');

      res.redirect(
        `/disputes?disputesPage=1${
          req.body.reason !== 'all' ? `&reason=${req.body.reason}` : ''
        }${req.query.adminDispute === 'true' ? '&adminDispute=true' : ''}`,
      );
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);

router.post(
  '/disputes/:id',
  isAuth,
  sanitizeParams, // isAdmin,
  async (req, res) => {
    try {
      const order = await OrderModel.findById(req.params.id).orFail(
        new Error(),
      );

      order.disputesSettings = {
        disputeAdmin: req.user.username,
      };

      await order.save();

      res.redirect('/disputes?disputesPage=1');
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);
router.post(
  '/settle-dispute/:id',
  isAuth,
  sanitizeParams, // isAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { winner } = req.body;

      console.log(winner);

      const order = await OrderModel.findById(id).orFail(new Error());

      if (order.disputesSettings.disputeAdmin !== req.user.username) throw new Error('Cant Access');

      let disputeWinner;
      if (winner === 'Both') disputeWinner = winner;
      else if (winner === order.vendor) disputeWinner = order.vendor;
      else disputeWinner = order.buyer;

      order.orderStatus = 'DISPUTED';
      order.timeUntilUpdate = Date.now() + 172800000;
      order.disputesSettings.disputeWinner = disputeWinner;
      order.disputesSettings.disputeAdmin = undefined;

      // Take Action depending on Winner (Ex: Give Refund etc...)

      await order.save();

      req.flash('success', 'Dispute Successfully Settle');
      res.redirect('/disputes?disputesPage=1&adminDispute=true');
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);

// Feedback
router.get(
  '/feedback',
  isAuth,
  sanitizeQuerys, // isAdmin,
  async (req, res) => {
    try {
      if (
        ![undefined, 'feedback', 'bug', 'help', 'other'].includes(
          req.query.reason,
        )
      ) {
        throw new Error('Invalid Reason to feedback');
      }
      if (![undefined, 'true', 'false'].includes(req.query.archived)) throw new Error('Invalid Archived Feedback');

      const feedbacks = await paginatedResults(
        Contactus,
        constructQuery(req.query),
        { page: req.query.feedbackPage, limit: 24 },
      );

      res.render('admin-feedbacks', { feedbacks });
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);
router.post(
  '/feedback-filter',
  isAuth,
  sanitizeQuerys, // isAdmin,
  async (req, res) => {
    try {
      const { reason, archived } = req.body;

      if (!['all', 'feedback', 'bug', 'help', 'other'].includes(reason)) throw new Error('Invalid Reason to feedback');
      if (!['all', 'true', 'false'].includes(archived)) throw new Error('Invalid Archived Feedback');

      res.redirect(
        `/feedback?feedbackPage=1${
          reason !== 'all' ? `&reason=${reason}` : ''
        }${archived !== 'all' ? `&archived=${archived}` : ''}`,
      );
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);
router.post(
  '/archive-feedback/:id',
  isAuth,
  sanitizeParamsQuerys, // isAdmin,
  async (req, res) => {
    try {
      const feedback = await Contactus.findById(req.params.id).orFail(
        new Error(),
      );

      feedback.archived = feedback.archived ? undefined : true;

      await feedback.save();

      res.redirect(
        `/feedback?feedbackPage=${
          req.query.feedbackPage ? req.query.feedbackPage : '1'
        }${req.query.reason ? `&reason=${req.query.reason}` : ''}${
          req.query.archived ? `&archived=${req.query.archived}` : ''
        }`,
      );
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);
router.post(
  '/delete-feedback/:id',
  isAuth,
  sanitizeParamsQuerys, // isAdmin,
  async (req, res) => {
    try {
      const feedback = await Contactus.findById(req.params.id).orFail(
        new Error(),
      );

      await feedback.deleteContactUs();

      res.redirect(
        `/feedback?feedbackPage=${
          req.query.feedbackPage ? req.query.feedbackPage : '1'
        }${req.query.reason ? `&reason=${req.query.reason}` : ''}${
          req.query.archived ? `&archived=${req.query.archived}` : ''
        }`,
      );
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);

// Promote
router.get(
  '/promote-user',
  isAuth,
  sanitizeQuerys, // isAdmin,
  async (req, res) => {
    try {
      const users = await paginatedResults(
        User,
        { awaiting_promotion: { $exists: true } },
        { page: req.query.usersPage, limit: 24 },
      );

      res.render('admin-promote', { users });
    } catch (e) {
      res.redirect('/404');
    }
  },
);
router.post(
  '/promote-user/:username',
  isAuth,
  sanitizeParamsQuerys, // isAdmin,
  async (req, res) => {
    try {
      const user = await User.findOne({ username: req.params.username }).orFail(
        new Error(),
      );

      user.awaiting_promotion = undefined;
      user.authorization = req.query.decline ? 'buyer' : 'vendor';

      await user.save();

      req.flash('success', 'User Sucessfully Promoted');
      res.redirect('/promote-user?usersPage=1');
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);

module.exports = router;
