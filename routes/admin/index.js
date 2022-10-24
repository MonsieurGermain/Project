const express = require('express');

const { isAuth } = require('../../middlewares/authentication');
const {
  validateReports,
  validateResolveReport,
  sanitizeParams,
  sanitizeQuerys,
  sanitizeParamsQuerys,
} = require('../../middlewares/validation');

const router = express.Router();

async function reportHimself(req, res, next) {
  try {
    if (req.params.id === req.user.username) throw new Error('Why do you want to report Yourself ?');
    next();
  } catch (e) {
    req.flash('error', e.message);
    res.redirect(`/user/profile/${req.user.username}?productPage=1&reviewPage=1`);
  }
}

const { archiveFeedback } = require('./archiveFeedback');
const { archiveReport } = require('./archiveReport');
const { banUser } = require('./banUser');
const { deleteFeedback } = require('./deleteFeedback');
const { dismissBanUser } = require('./dismissBanUser');
const { dismissReport } = require('./dismissReport');
const { dispute } = require('./dispute');
const { filterBanUser } = require('./filterBanUser');
const { filterDisputes } = require('./filterDisputes');
const { filterFeedbacks } = require('./filterFeedbacks');
const { filterReports } = require('./filterReports');
const { promoteUser } = require('./promoteUser');
const { report } = require('./report');
const { resolveReport } = require('./resolveReport');
const { takeDispute } = require('./takeDispute');

const { getBanUsers } = require('./getBanUsers');
const { getDisputes } = require('./getDisputes');
const { getFeedbacks } = require('./getFeedbacks');
const { getPromote } = require('./getPromote');
const { getReports } = require('./getReports');

router.post('/archive-feedback/:id', [isAuth, sanitizeParamsQuerys], archiveFeedback); // isAdmin
router.post('/archive-report/:id', [isAuth, sanitizeParamsQuerys], archiveReport); // isAdmin
router.post('/ban-user/:id', [isAuth, sanitizeParamsQuerys], banUser); // isAdmin
router.post('/delete-feedback/:id', [isAuth, sanitizeParamsQuerys], deleteFeedback); // isAdmin
router.post('/dismiss-ban-request/:id', [isAuth, sanitizeParamsQuerys], dismissBanUser); // isAdmin
router.post('/dismiss-report/:id', [isAuth, sanitizeParamsQuerys], dismissReport); // isAdmin
router.post('/settle-dispute/:id', [isAuth, sanitizeParams], dispute); // isAdmin
router.post('/report-filter', [isAuth, sanitizeQuerys], filterBanUser); // isAdmin
router.post('/feedback-filter', [isAuth, sanitizeQuerys], filterFeedbacks); // isAdmin
router.post('/disputes-filter', [isAuth, sanitizeParams], filterDisputes); // isAdmin
router.post('/ban-user-filter', [isAuth, sanitizeQuerys], filterReports); // isAdmin
router.post('/promote-user/:username', [isAuth, sanitizeParamsQuerys], promoteUser); // isAdmin
router.post('/report/:id', [isAuth, sanitizeParamsQuerys, validateReports, reportHimself], report); // isAdmin
router.post('/resolve-report/:id', [isAuth, sanitizeParamsQuerys, validateResolveReport], resolveReport); // isAdmin
router.post('/disputes/:id', [isAuth, sanitizeParams], takeDispute); // isAdmin

router.get('/admin/ban-user', [isAuth, sanitizeQuerys], getBanUsers); // isAdmin
router.get('/admin/disputes', [isAuth, sanitizeQuerys], getDisputes); // isAdmin
router.get('/admin/feedback', [isAuth, sanitizeQuerys], getFeedbacks); // isAdmin
router.get('/admin/promote-user', [isAuth, sanitizeQuerys], getPromote); // isAdmin
router.get('/admin/reports', [isAuth, sanitizeQuerys], getReports); // isAdmin

module.exports = router;
