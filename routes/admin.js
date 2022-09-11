const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Order = require('../models/order');
const Report = require('../models/report');
const Product = require('../models/product');
const Contactus = require('../models/contactus');
const {Need_Authentification} = require('../middlewares/authentication');
const {validateReports, validateResolveReport, sanitizeParams, sanitizeQuerys, sanitizeParamsQuerys} = require('../middlewares/validation');
const {formatUsernameWithSettings, paginatedResults} = require('../middlewares/function');

async function getResolveReportDocuments(type, id) {
   let user, product;
   switch (type) {
      case 'vendor':
         user = await User.findOne({username: id});
         break;
      case 'product':
         product = await Product.findOne({slug: id});
         user = await User.findOne({username: product.vendor});
         break;
      default:
         throw new Error('Invalid Type');
   }
   return {user, product};
}

function hideBuyerUsername(disputes) {
   for (let i = 0; i < disputes.length; i++) {
      disputes[i].buyer = formatUsernameWithSettings(disputes[i].buyer, disputes[i].privacy);
   }
   return disputes;
}

function constructQuery(query) {
   const mongooseQuery = {};
   if (query.reason) mongooseQuery.reason = query.reason;
   if (query.archived) mongooseQuery.archived = query.archived === 'true' ? {$exists: true} : {$exists: false};

   return mongooseQuery;
}

function validateData(value, acceptedValues) {
   for (let i = 0; i < acceptedValues.length; i++) {
      if (acceptedValues[i] === value) return true;
   }
   return;
}


router.post('/report/:id', Need_Authentification, sanitizeParamsQuerys, validateReports,
   async (req, res, next) => {
      try { 
         if (req.params.id === req.user.username) throw new Error('Why do you want to report Yourself ?')
         next()
      } catch (e) {
         req.flash('error', e.message);
         res.redirect(`/profile/${req.user.username}?productPage=1&reviewPage=1`);
      }
   },
   async (req, res, next) => { 
       try {
         console.log(req.query)
         if (!validateData(req.query.type, ['vendor', 'product'])) throw new Error('Invalid type to report')

         switch (req.query.type) {
            case 'vendor':
               await User.findOne({username: req.params.id}).orFail(new Error());
               break;
            case 'product':
               await Product.findOne({slug: req.params.id}).orFail(new Error());
               break;
            default:
               throw new Error()
         }

         const {type, url} = req.query;
         const {id} = req.params;
         const {reason, username, message} = req.body;

         const report = new Report({
            reference_id: id,
            type,
            username,
            message,
            reason,
         });

         report.save();

         req.flash('success', 'Thank you for your Report, we are now Investigating');
         res.redirect(url);
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);

// Admin Report
router.get('/reports', Need_Authentification, sanitizeQuerys,// isAdmin,
   async (req, res) => {
      try {
         if (!validateData(req.query.reason, [undefined, 'scam', 'blackmail', 'information', 'other'])) throw new Error('Invalid type to report')
         if (!validateData(req.query.archived, [undefined, 'true', 'false'])) throw new Error('Invalid type to report')

         const query = constructQuery(req.query);

         query.ban_requested = {$exists: false};

         const reports = await paginatedResults(Report, query, {page: req.query.reportsPage, limit: 24});

         res.render('admin-reports', {reports});
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);
router.post('/report-filter', Need_Authentification, sanitizeQuerys,// isAdmin,
   async (req, res) => {
      try {
         const {reason, archived} = req.body;

         if (!validateData(reason, ['all', 'scam', 'blackmail', 'information', 'other'])) throw new Error('Invalid type to report')
         if (!validateData(archived, ['all', 'true', 'false'])) throw new Error('Invalid type to report')

         let query = '?reportsPage=1';

         if (reason !== 'all') query += `&reason=${reason}`;
         if (archived !== 'all') query += `&archived=${archived}`;

         res.redirect(`/reports${query}`);
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);
router.post('/archive-report/:id', Need_Authentification, sanitizeParamsQuerys,// isAdmin,
   async (req, res) => {
      try {
         const report = await Report.findById(req.params.id).orFail(new Error())

         report.archived = report.archived ? undefined : true;

         await report.save();

         req.flash('success', 'Report Successfully Archived/Unarchived');
         res.redirect(`/reports?reportsPage=${req.query.reportsPage ? req.query.reportsPage : '1'}${req.query.reason ? `&reason=${req.query.reason}`: ''}${req.query.archived ? `&archived=${req.query.archived}`: ''}`);
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);
router.post('/dismiss-report/:id', Need_Authentification, sanitizeParamsQuerys,// isAdmin,
   async (req, res) => {
      try {
         const report = await Report.findById(req.params.id).orFail(new Error())

         await report.deleteReport();

         req.flash('success', 'Report Successfully Dismissed');
         res.redirect(`/reports?reportsPage=${req.query.reportsPage ? req.query.reportsPage : '1'}${req.query.reason ? `&reason=${req.query.reason}`: ''}${req.query.archived ? `&archived=${req.query.archived}`: ''}`);
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);
router.post('/resolve-report/:id', Need_Authentification, sanitizeParamsQuerys,// isAdmin,
   validateResolveReport,
   async (req, res) => {
      try {
         const report = await Report.findById(req.params.id).orFail(new Error())

         const {message, ban, banReason} = req.body; // Why Message ?

         const {user, product} = await getResolveReportDocuments(report.type, report.reference_id);

         if (product) {
            product.status === 'offline';
            product.save();
         }

         user.warning++;
         
         if (user.warning > 5) {
            user.deleteUser();
         } 
         else user.save();

         let flashMessage = 'The Vendor as been given a warning';
         if (ban) {
            report.ban_requested = true;
            report.ban_explanation = banReason;
            flashMessage = 'A request to ban this vendor as been made';
            await report.save();
         } else await report.deleteReport();

         // Send Message to Vendor

         req.flash('success', flashMessage);
         res.redirect(`/reports?reportsPage=${req.query.reportsPage ? req.query.reportsPage : '1'}${req.query.reason ? `&reason=${req.query.reason}`: ''}${req.query.archived ? `&archived=${req.query.archived}`: ''}`);
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);


// Ban User
router.get('/ban-user', Need_Authentification, sanitizeQuerys,// isAdmin,
   async (req, res) => {
      try {
         if (!validateData(req.query.reason, [undefined, 'scam', 'blackmail', 'information', 'other'])) throw new Error('Invalid type to report')

         const query = constructQuery(req.query);
         query.ban_requested = {$exists: true};

         const reports = await paginatedResults(Report, query, {page: req.query.reportsPage, limit: 24});

         res.render('admin-ban-user', {reports});
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);
router.post('/ban-user-filter', Need_Authentification, sanitizeQuerys,// isAdmin,
   async (req, res) => {
      try {
         const {reason, archived} = req.body;

         if (!validateData(reason, ['all', 'scam', 'blackmail', 'information', 'other'])) throw new Error('Invalid type to report')

         let query = '?reportsPage=1';

         if (reason !== 'all') query += `&reason=${reason}`;

         res.redirect(`/ban-user${query}`);
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);
router.post('/dismiss-ban-request/:id', Need_Authentification, sanitizeParamsQuerys,// isAdmin,
   async (req, res) => {
      try {
         const report = await Report.findById(req.params.id).orFail(new Error())

         report.deleteReport();

         req.flash('success', 'Ban Request Successfully Dismissed');
         res.redirect(`/ban-user?reportsPage=${req.query.reportsPage ? req.query.reportsPage : '1'}${req.query.reason ? `&reason=${req.query.reason}`: ''}}`);
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);
router.post('/ban-user/:id', Need_Authentification, sanitizeParamsQuerys,// isAdmin,
   async (req, res) => {
      try {
         const report = await Report.findById(req.params.id).orFail(new Error())

         const {user} = await getResolveReportDocuments(report.type, report.reference_id);

         user.deleteUser();
         report.deleteReport();

         req.flash('success', 'User Successfully Banned');
         res.redirect(`/ban-user?reportsPage=${req.query.reportsPage ? req.query.reportsPage : '1'}${req.query.reason ? `&reason=${req.query.reason}`: ''}`);
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);

// Disputes
router.get('/disputes', Need_Authentification, sanitizeQuerys,//isAdmin,
   async (req, res) => {
      try {
         const {adminDispute} = req.query;

         const query = adminDispute ? {status: 'dispute_progress', admin: req.user.username} : {status: 'dispute_progress', admin: undefined};

         let disputes = await paginatedResults(Order, query, {page: req.query.disputesPage, limit: 24});

         disputes.results = hideBuyerUsername(disputes.results);

         res.render('admin-dispute-list', {disputes});
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);
router.post('/disputes/:id', Need_Authentification, sanitizeParams,//isAdmin,
   async (req, res) => {
      try {

         const order = await Order.findById(req.params.id).orFail(new Error())

         order.admin = req.user.username;

         await order.save();

         res.redirect('/disputes?disputesPage=1');
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);
router.post('/settle-dispute/:id', Need_Authentification, sanitizeParams,// isAdmin,
   async (req, res) => {
      try {
         const order = await Order.findById(req.params.id).orFail(new Error())

         if (order.admin !== req.user.username) throw new Error('Cant Access');

         let winner;
         switch(req.body.winner) {
            case order.vendor:
               winner = order.vendor;
            break
            default : 
            winner = order.buyer;
         }

         order.status = 'disputed';
         order.timer = Date.now() + 172800000;
         order.dispute_winner = winner;

         await order.save();

         req.flash('success', 'Dispute Successfully Settle');
         res.redirect(`/disputes?disputesPage=1&adminDispute=true`);
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);

// Feedback
router.get('/feedback', Need_Authentification, sanitizeQuerys,// isAdmin,
   async (req, res) => {
      try {
         if (!validateData(req.query.reason, [undefined, 'feedback', 'bug', 'help', 'other'])) throw new Error('Invalid Reason to feedback')
         if (!validateData(req.query.archived, [undefined, 'true', 'false'])) throw new Error('Invalid Archived Feedback')

         const feedbacks = await paginatedResults(Contactus, constructQuery(req.query), {page: req.query.feedbackPage, limit: 24});

         res.render('admin-feedbacks', {feedbacks});
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);
router.post('/feedback-filter', Need_Authentification, sanitizeQuerys,// isAdmin,
   async (req, res) => {
      try {
         const {reason, archived} = req.body;

         if (!validateData(reason, ['all', 'feedback', 'bug', 'help', 'other'])) throw new Error('Invalid Reason to feedback')
         if (!validateData(archived, ['all', 'true', 'false'])) throw new Error('Invalid Archived Feedback')


         let query = '?feedbackPage=1';

         if (reason !== 'all') query += `&reason=${reason}`;
         if (archived !== 'all') query += `&archived=${archived}`;

         res.redirect(`/feedback${query}`);
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);
router.post('/archive-feedback/:id', Need_Authentification, sanitizeParamsQuerys,// isAdmin,
   async (req, res) => {
      try {
         const feedback = await Contactus.findById(req.params.id).orFail(new Error())

         feedback.archived = feedback.archived ? undefined : true;

         await feedback.save();

         res.redirect(`/feedback?feedbackPage=${req.query.feedbackPage ? req.query.feedbackPage : '1'}${req.query.reason ? `&reason=${req.query.reason}`: ''}${req.query.archived ? `&archived=${req.query.archived}`: ''}`);
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);
router.post('/delete-feedback/:id', Need_Authentification, sanitizeParamsQuerys,// isAdmin,
   async (req, res) => {
      try {
         const feedback = await Contactus.findById(req.params.id).orFail(new Error())

         await feedback.deleteContactUs();

         res.redirect(`/feedback?feedbackPage=${req.query.feedbackPage ? req.query.feedbackPage : '1'}${req.query.reason ? `&reason=${req.query.reason}`: ''}${req.query.archived ? `&archived=${req.query.archived}`: ''}`);
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);

// Promote
router.get('/promote-user', Need_Authentification, sanitizeQuerys,// isAdmin,
   async (req, res) => {
      try {
         const users = await paginatedResults(User, {awaiting_promotion: {$exists: true}}, {page: req.query.usersPage, limit: 24});

         res.render('admin-promote', {users});
      } catch (e) {
         res.redirect('/404');
      }
   }
);
router.post('/promote-user/:username', Need_Authentification, sanitizeParamsQuerys,// isAdmin,
   async (req, res) => {
      try {
         const user = await User.findOne({username: req.params.username}).orFail(new Error())

         user.awaiting_promotion = undefined;
         if (!req.query.decline) user.authorization = 'vendor';

         await user.save();

         req.flash('success', 'User Sucessfully Promoted');
         res.redirect(`/promote-user?usersPage=1`);
      } catch (e) {
         console.log(e)
         res.redirect('/404');
      }
   }
);

module.exports = router;
