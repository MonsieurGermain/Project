const express = require('express');

const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/user');
const Product = require('../models/product');
const Conversation = require('../models/conversation');
const { isAuth } = require('../middlewares/authentication');
const {
  sanitizeChangePassword,
  sanitizeQuerys,
  sanitizeParams,
  sanitizeParamsQuerys,
  validateMessageSettings,
} = require('../middlewares/validation');
const {
  paginatedResults, randomListOfWords, isEmail, isPgpKeys, isMoneroAddress, generateRandomString,
} = require('../middlewares/function');

router.get('/user/settings/security', isAuth, async (req, res) => {
  try {
    res.render('Pages/settingsPages/securityPage');
  } catch (e) {
    console.log(e);
    res.redirect('/user/settings/security');
  }
});

router.get('/user/settings/privacy', isAuth, async (req, res) => {
  try {
    res.render('Pages/settingsPages/privacyPage');
  } catch (e) {
    console.log(e);
    res.redirect('/user/settings/privacy');
  }
});

router.get('/user/settings/payment', isAuth, async (req, res) => {
  try {
    res.render('Pages/settingsPages/paymentPage');
  } catch (e) {
    console.log(e);
    res.redirect('/user/settings/payment');
  }
});

router.get('/user/settings/notifications', isAuth, async (req, res) => {
  try {
    res.render('Pages/settingsPages/notificationsPage');
  } catch (e) {
    console.log(e);
    res.redirect('/user/settings/notification');
  }
});

router.get('/user/settings/savedProducts', isAuth, sanitizeQuerys, async (req, res) => {
  try {
    const productPage = parseFloat(req.query.productPage) || 1;

    let paginatedProducts = await paginatedResults(Product, { slug: { $in: req.user.saved_product }, status: 'online' }, { page: productPage, limit: 24 });

    res.render('Pages/settingsPages/savedProductsPage', { paginatedProducts });
  } catch (e) {
    console.log(e);
    res.redirect('/user/settings/savedProducts');
  }
});

router.post('/add-xmr-address', isAuth, async (req, res) => {
  try {
    const { user } = req;

    const moneroAddress = isMoneroAddress(req.body.vendorMoneroAddress, '');

    const successMessage = user.moneroAddress ? 'Monero Address Successfully Changed' : 'Monero Address Successfully Added';

    user.vendorMoneroAddress = moneroAddress;

    await user.save();

    req.flash('success', successMessage);
    res.redirect('/settings?section=payment');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/settings?section=payment');
  }
});
router.post('/add-xmr-refund-address', isAuth, async (req, res) => {
  try {
    const { user } = req;
    const moneroRefundAddress = isMoneroAddress(req.body.xmrRefundAddress, 'Refund');

    const successMessage = user.moneroRefundAddress ? 'Monero Address Successfully Changed' : 'Monero Address Successfully Added';

    user.xmrRefundAddress = moneroRefundAddress;

    await user.save();

    req.flash('success', successMessage);
    res.redirect('/settings?section=payment');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/settings?section=payment');
  }
});
router.post('/delete-address', isAuth, sanitizeQuerys, async (req, res) => {
  try {
    const { user } = req;
    const { addressType } = req.query;

    switch (addressType) {
      case 'personal':
        user.vendorMoneroAddress = undefined;
        await user.offlineAllUserProducts();
        req.flash('warning', 'Your Monero Address as been Deleted, all of your Product with no Custom Monero Address are now Offline');
        break;
      case 'refund':
        user.xmrRefundAddress = undefined;
        req.flash('success', 'Your Refund Address as been Deleted');
        break;
      default:
        throw new Error('Invalid Query');
    }

    await user.save();

    res.redirect('/settings?section=payment');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/settings?section=payment');
  }
});

async function updateConversationPgp(username, newPgp) {
  const conversations = await Conversation.findAllUserConversations(username);

  for (let i = 0; i < conversations.length; i++) {
    conversations[i].updateNewPgp(username, newPgp);
  }
}

router.post('/add-pgp', isAuth, async (req, res) => {
  try {
    const { user } = req;

    const pgp = isPgpKeys(req.body.pgp);

    user.pgp_keys = pgp.trim();
    user.verifiedPgpKeys = undefined;
    user.pgp_keys_verification_words = randomListOfWords(12);
    user.pgp_keys_verification_words_encrypted = user.pgp_keys_verification_words; // Encrypt It with user pgp

    await user.save();

    req.flash('success', 'A new Pgp Keys as Been added, you just need Verify it');
    res.redirect('/settings?section=security');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/settings?section=security');
  }
});
router.post('/delete-pgp', isAuth, async (req, res) => {
  try {
    const { user } = req;

    user.pgp_keys = undefined;
    user.verifiedPgpKeys = undefined;
    user.pgp_keys_verification_words = undefined;
    user.pgp_keys_verification_words_encrypted = undefined;
    user.settings.step_verification = user.settings.step_verification === 'pgp' ? undefined : user.settings.step_verification;

    await updateConversationPgp(user.username, undefined);

    await user.save();

    req.flash('success', 'Pgp Keys Successfully Deleted');
    res.redirect('/settings?section=security');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});
router.post('/verify-pgp', isAuth, async (req, res) => {
  try {
    const { user } = req;
    const { pgpVerification } = req.body;

    if (!pgpVerification || pgpVerification !== user.pgp_keys_verification_words) throw new Error('Invalid Code... try Again');

    user.verifiedPgpKeys = user.pgp_keys;
    user.pgp_keys = undefined;
    user.pgp_keys_verification_words = undefined;
    user.pgp_keys_verification_words_encrypted = undefined;

    await updateConversationPgp(user.username, user.verifiedPgpKeys);
    await user.save();

    req.flash('success', 'Pgp Successfully Verified');
    res.redirect('/settings?section=security');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.post('/add-email', isAuth, async (req, res) => {
  try {
    const { user } = req;
    const { email } = req.body;

    if (!isEmail(email)) throw new Error('This Email Address is Invalid');

    user.email = email;

    user.email_verification_code = generateRandomString(6, 'number');

    // Send Email Containning Verification Code
    console.log(`The Verification Code is: ${user.email_verification_code}`);

    await user.save();

    req.flash('success', 'Email Address Successfully Added');
    res.redirect('/settings?section=security');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/settings?section=security');
  }
});
router.post('/delete-email', isAuth, async (req, res) => {
  try {
    const { user } = req;

    user.email = undefined;
    user.email_verification_code = undefined;
    user.settings.step_verification = user.settings.step_verification === 'email' ? undefined : user.settings.step_verification;

    await user.save();

    req.flash('success', 'Email Address Successfully Deleted');
    res.redirect('/settings?section=security');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});
router.post('/confirm-email', isAuth, async (req, res) => {
  try {
    const { user } = req;
    const confirmationCode = req.body.confirmation_code.trim();

    if (typeof (confirmationCode) !== 'string' || confirmationCode.length !== 6 || user.email_verification_code !== confirmationCode) throw new Error('Invalid Confirmation Code, try Again');

    user.email_verification_code = undefined;

    await user.save();

    req.flash('success', 'Email Successfully Verified');
    res.redirect('/settings?section=security');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/settings?section=security');
  }
});
router.post('/resend-email-verification', isAuth, async (req, res) => {
  try {
    const { user } = req;

    if (!user.email || !user.email_verification_code) throw new Error();

    user.email_verification_code = generateRandomString(6, 'number');

    console.log(user.email_verification_code);

    // Resend Email with new Confirmation Code

    await user.save();

    req.flash('success', 'Verifaction Code Resended');
    res.redirect('/settings?section=security');
  } catch (e) {
    res.redirect('/settings?section=security');
  }
});

router.post('/enable-2fa', isAuth, async (req, res) => {
  try {
    const { user } = req;
    const { stepVerification } = req.body;

    switch (stepVerification) {
      case 'email':
        if (user.email_verification_code || !user.email) throw new Error('You need to add/verify your Email address to be able to do that');
        break;
      case 'pgp':
        if (!user.verifiedPgpKeys) throw new Error('You need to add/verify your Pgp key to be able to do that');
        break;
      default:
        throw new Error('Invalid 2 Step Verification');
    }

    user.settings.step_verification = stepVerification;

    await user.save();

    req.flash('success', '2 Step Verification Successfully Activated');
    res.redirect('/settings?section=security');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/settings?section=security');
  }
});
router.post('/remove-2fa', isAuth, async (req, res) => {
  try {
    const { user } = req;

    user.settings.step_verification = undefined;

    await user.save();

    req.flash('success', '2 Step Verification Successfully Removed');
    res.redirect('/settings?section=security');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.put('/change-password', isAuth, sanitizeChangePassword, async (req, res) => {
  try {
    const { user } = req;
    const { password, newPassword } = req.body;

    if (!bcrypt.compareSync(password, user.password)) throw new Error('Invalid Password');

    user.password = await bcrypt.hash(newPassword, 10);

    await user.save();

    req.flash('success', 'Password Successfully Changed');
    res.redirect('/settings?section=security');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/settings?section=security');
  }
});

router.delete('/delete-user', isAuth, async (req, res) => {
  try {
    await req.user.deleteUser();

    req.logOut();
    res.redirect('/login');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.post('/conversation-settings', isAuth, validateMessageSettings, async (req, res) => {
  try {
    const { user } = req;
    const {
      conversationUsername,
      conversationPgp,
      messageExpiryDate,
      convoExpiryDate,
      includeTimestamps,
      messageView,
      deleteEmpty,
      customUsername,
      customPgp,
    } = req.body;

    user.settings.messageSettings.conversationUsername = conversationUsername;
    user.settings.messageSettings.conversationPgp = conversationPgp;
    user.settings.messageSettings.messageExpiryDate = messageExpiryDate;
    user.settings.messageSettings.convoExpiryDate = convoExpiryDate;
    user.settings.messageSettings.includeTimestamps = includeTimestamps || undefined;
    user.settings.messageSettings.messageView = messageView || undefined;
    user.settings.messageSettings.deleteEmpty = deleteEmpty || undefined;

    user.settings.messageSettings.customUsername = customUsername || undefined;
    user.settings.messageSettings.customPgp = customPgp || undefined;

    await user.save();

    req.flash('success', 'Default Conversation Settings successfully changed');
    res.redirect('/settings?section=privacy');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});
router.post('/order-settings', isAuth, async (req, res) => {
  try {
    const { user } = req;
    const { autoDeleteProvidedInfo } = req.body;

    if (!['never', '-1', '1', '3', '7', '30'].includes(autoDeleteProvidedInfo)) throw new Error('Invalid Value');

    user.settings.privateInfoExpiring = autoDeleteProvidedInfo !== 'never' ? autoDeleteProvidedInfo : undefined;

    await user.save();

    req.flash('success', 'Order Settings successfully changed');
    res.redirect('/settings?section=privacy');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.post('/account-settings', isAuth, async (req, res) => {
  try {
    const { user } = req;
    const { autoDeleteAccount } = req.body;

    if (!['never', '7', '14', '30', '365'].includes(autoDeleteAccount)) throw new Error('Invalid Value');

    user.settings.userExpiring = autoDeleteAccount !== 'never' ? autoDeleteAccount : undefined;
    user.expire_at = user.settings.userExpiring ? user.settings.userExpiring * 86400000 + Date.now() : undefined;

    await user.save();

    req.flash('success', 'Account Settings successfully changed');
    res.redirect('/settings?section=privacy');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.post('/reset-privacy', isAuth, sanitizeQuerys, async (req, res) => {
  try {
    const { user } = req;
    const { type } = req.query;

    if (!['conversation', 'order', 'account'].includes(type)) throw new Error('Invalid Value');

    switch (type) {
      case 'conversation':
        user.settings.messageSettings.conversationUsername = 'ownUsername';
        user.settings.messageSettings.conversationPgp = 'showPgp';
        user.settings.messageSettings.messageExpiryDate = 7;
        user.settings.messageSettings.convoExpiryDate = 180;
        user.settings.messageSettings.includeTimestamps = false;
        user.settings.messageSettings.messageView = false;
        user.settings.messageSettings.deleteEmpty = true;
        break;
      case 'conversation':
        user.settings.userExpiring = undefined;
        user.expire_at = undefined;
        break;
      default:
        user.settings.privateInfoExpiring = 7;
    }

    await user.save();

    res.redirect('/settings?section=privacy');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.post('/saved_product/:slug', isAuth, sanitizeParamsQuerys, async (req, res) => {
  try {
    const { url } = req.query;

    await Product.findOne({ slug: req.params.slug }).orFail(new Error('Invalid Product Slug'));

    const user = await User.findOne({ username: req.user.username });

    user.Add_Remove_Saved_Product(req.params.slug);

    await user.save();

    res.redirect(url ? `${url}` : '/settings?section=saved&productPage=1');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.post('/delete-notification/:conversationId', isAuth, sanitizeParams, async (req, res) => {
  try {
    const { user } = req;
    const { conversationId } = req.params;

    await user.deleteNotification({ conversationId });

    res.redirect('/user/settings/notifications');
  } catch (e) {
    console.log(e);
    req.flash('error', e.message);
    res.redirect('/user/settings/notifications');
  }
});

module.exports = router;
