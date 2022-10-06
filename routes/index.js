const express = require('express');

const router = express.Router();

const homeRouter = require('./home');
const loginRouter = require('./login');
const profileRouter = require('./profile');
const productsRouter = require('./products');
const errorRouter = require('./404');
const messageRouter = require('./message');
const orderRouter = require('./order');
const reviewRouter = require('./review');
const settingsRouter = require('./settings');
const adminRouter = require('./admin');
const documentationRouter = require('./documentation');

router.use('/', homeRouter);
router.use('/', loginRouter);
router.use('/', profileRouter);
router.use('/', productsRouter);
router.use('/', errorRouter);
router.use('/', messageRouter);
router.use('/', orderRouter);
router.use('/', reviewRouter);
router.use('/', settingsRouter);
router.use('/', adminRouter);
router.use('/', documentationRouter);

module.exports = router;
