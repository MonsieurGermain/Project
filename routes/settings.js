const express = require('express');

const router = express.Router();
const bcrypt = require('bcrypt');
const UserModel = require('../models/user');
const Product = require('../models/product');
const ConversationModel = require('../models/conversation');
const { isAuth } = require('../middlewares/authentication');
const {
  sanitizeChangePassword,
  sanitizeQuerys,
  sanitizeParams,
  sanitizeParamsQuerys,
  validateMessageSettings,
  validateNotificationSettings,
} = require('../middlewares/validation');
const {
  paginatedResults, randomListOfWords, isEmail, isPgpKeys, isMoneroAddress, generateRandomString,
} = require('../middlewares/function');
const { sendVerificationCode } = require('../utils/email');
const { encrypt } = require('../utils/pgp');

router.get('/user/settings/security', isAuth, async (req, res) => {
  try {
    res.render('Pages/settingsPages/security');
  } catch (e) {
    console.log(e);
    res.redirect('/user/settings/security');
  }
});

router.get('/user/settings/privacy', isAuth, async (req, res) => {
  try {
    const notificationChoices = [
      {
        name: 'orderStatusChange',
        text: 'When the status of one of your order change',
      },
      {
        name: 'newConversation',
        text: 'When a new Conversation is created with you',
      },
      {
        name: 'newMessage',
        text: 'When a user send you a new Message',
      },
      {
        name: 'changeConversationSettings',
        text: 'When a user Change the settings of a conversation that you are in',
      },
      {
        name: 'deleteMessage',
        text: 'When a user Delete one of his message in a conversation with you',
      },
      {
        name: 'deleteConversation',
        text: 'When a user Delete a conversation with you',
      },
      {
        name: 'newUpdate',
        text: 'When the site recieve a new update',
      },
    ];
    res.render('Pages/settingsPages/privacy', { notificationChoices });
  } catch (e) {
    console.log(e);
    res.redirect('/user/settings/privacy');
  }
});

router.get('/user/settings/payment', isAuth, async (req, res) => {
  try {
    res.render('Pages/settingsPages/payment');
  } catch (e) {
    console.log(e);
    res.redirect('/user/settings/payment');
  }
});

router.get('/user/settings/notifications', isAuth, async (req, res) => {
  try {
    const { user } = req;

    res.render('Pages/settingsPages/notifications', { userNotifications: user.notifications });

    user.deleteOnSeeNotification();
    user.sawNotification();
    user.save();
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.get('/user/settings/savedProducts', isAuth, sanitizeQuerys, async (req, res) => {
  try {
    const productPage = parseFloat(req.query.productPage) || 1;

    let paginatedProducts = await paginatedResults(Product, { slug: { $in: req.user.saved_product }, status: 'online' }, { page: productPage, limit: 24 });

    res.render('Pages/settingsPages/savedProducts', { paginatedProducts });
  } catch (e) {
    console.log(e);
    res.redirect('/user/settings/savedProducts');
  }
});

router.post('/delete-notification/:notificationId', isAuth, sanitizeParams, async (req, res) => {
  try {
    const { user } = req;
    const { notificationId } = req.params;

    user.deleteNotification({ notificationId });

    await user.save();

    res.redirect('/user/settings/notifications');
  } catch (e) {
    console.log(e);
    req.flash('error', e.message);
    res.redirect('/user/settings/notifications');
  }
});

router.post('/notifications-settings', isAuth, validateNotificationSettings, async (req, res) => {
  try {
    const { user } = req;
    const {
      recordNotification, expiryDateNotification, seen, sendNotification,
    } = req.body;

    let flashMessage;

    if (recordNotification) {
      flashMessage = 'Notification Settings Successfully Changed';

      user.settings.notificationsSettings.recordNotification = recordNotification;
      user.settings.notificationsSettings.expiryDate = expiryDateNotification;
      user.settings.notificationsSettings.seen = seen;
      user.settings.notificationsSettings.sendNotification = sendNotification;
    } else {
      flashMessage = 'Notification successfully disabled';

      user.settings.notificationsSettings = undefined;
    }

    await user.save();

    req.flash('success', flashMessage);
    res.redirect('/user/settings/privacy');
  } catch (e) {
    console.log(e);
    req.flash('error', 'There as been an Error, please try again');
    res.redirect('/user/settings/privacy');
  }
});

router.post('/add-xmr-address', isAuth, async (req, res) => {
  try {
    const { user } = req;

    const moneroAddress = isMoneroAddress(req.body.vendorMoneroAddress, '');

    const successMessage = user.moneroAddress
      ? 'Monero Address Successfully Changed'
      : 'Monero Address Successfully Added';

    user.vendorMoneroAddress = moneroAddress;

    await user.save();

    req.flash('success', successMessage);
    res.redirect('/user/settings/payment');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/user/settings/payment');
  }
});
router.post('/add-xmr-refund-address', isAuth, async (req, res) => {
  try {
    const { user } = req;
    const moneroRefundAddress = isMoneroAddress(
      req.body.xmrRefundAddress,
      'Refund',
    );

    const successMessage = user.moneroRefundAddress
      ? 'Monero Address Successfully Changed'
      : 'Monero Address Successfully Added';

    user.xmrRefundAddress = moneroRefundAddress;

    await user.save();

    req.flash('success', successMessage);
    res.redirect('/user/settings/payment');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/user/settings/payment');
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
        req.flash(
          'warning',
          'Your Monero Address as been Deleted, all of your Product with no Custom Monero Address are now Offline',
        );
        break;
      case 'refund':
        user.xmrRefundAddress = undefined;
        req.flash('success', 'Your Refund Address as been Deleted');
        break;
      default:
        throw new Error('Invalid Query');
    }

    await user.save();

    res.redirect('/user/settings/payment');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/user/settings/payment');
  }
});

async function updateConversationPgp(username, newPgp) {
  const conversations = await ConversationModel.findAllUserConversations(username);

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

    const encryptedVerificationWords = await encrypt(
      user.pgp_keys,
      user.pgp_keys_verification_words,
    );

    user.pgp_keys_verification_words_encrypted = encryptedVerificationWords;

    await user.save();

    req.flash('success', 'A new Pgp Keys as Been added, you just need Verify it');
    res.redirect('/user/settings/security');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/user/settings/security');
  }
});
router.post('/delete-pgp', isAuth, async (req, res) => {
  try {
    const { user } = req;

    user.pgp_keys = undefined;
    user.verifiedPgpKeys = undefined;
    user.pgp_keys_verification_words = undefined;
    user.pgp_keys_verification_words_encrypted = undefined;
    user.settings.step_verification = user.settings.step_verification === 'pgp'
      ? undefined
      : user.settings.step_verification;

    await updateConversationPgp(user.username, undefined);

    await user.save();

    req.flash('success', 'Pgp Keys Successfully Deleted');
    res.redirect('/user/settings/security');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});
router.post('/verify-pgp', isAuth, async (req, res) => {
  try {
    const { user } = req;
    const { pgpVerification } = req.body;

    if (!pgpVerification) {
      throw new Error('Invalid Code... try Again');
    }

    if (pgpVerification.trim() !== user.pgp_keys_verification_words.trim()) {
      throw new Error('Invalid Code... try Again');
    }

    user.verifiedPgpKeys = user.pgp_keys;
    user.pgp_keys = undefined;
    user.pgp_keys_verification_words = undefined;
    user.pgp_keys_verification_words_encrypted = undefined;

    await updateConversationPgp(user.username, user.verifiedPgpKeys);
    await user.save();

    req.flash('success', 'Pgp Successfully Verified');
    res.redirect('/user/settings/security');
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

    await sendVerificationCode(user.email, user.email_verification_code);
    await user.save();

    req.flash('success', 'Email Address Successfully Added');
    res.redirect('/user/settings/security');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/user/settings/security');
  }
});
router.post('/delete-email', isAuth, async (req, res) => {
  try {
    const { user } = req;

    user.email = undefined;
    user.email_verification_code = undefined;
    user.settings.step_verification = user.settings.step_verification === 'email'
      ? undefined
      : user.settings.step_verification;

    await user.save();

    req.flash('success', 'Email Address Successfully Deleted');
    res.redirect('/user/settings/security');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});
router.post('/confirm-email', isAuth, async (req, res) => {
  try {
    const { user } = req;
    const confirmationCode = req.body.confirmation_code.trim();

    if (
      typeof confirmationCode !== 'string'
      || confirmationCode.length !== 6
      || user.email_verification_code !== confirmationCode
    ) throw new Error('Invalid Confirmation Code, try Again');

    user.email_verification_code = undefined;

    await user.save();

    req.flash('success', 'Email Successfully Verified');
    res.redirect('/user/settings/security');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/user/settings/security');
  }
});
router.post('/resend-email-verification', isAuth, async (req, res) => {
  try {
    const { user } = req;

    if (!user.email || !user.email_verification_code) throw new Error();

    user.email_verification_code = generateRandomString(6, 'number');

    await sendVerificationCode(user.email, user.email_verification_code);

    // Resend Email with new Confirmation Code

    await user.save();

    req.flash('success', 'Verifaction Code Resended');
    res.redirect('/user/settings/security');
  } catch (e) {
    res.redirect('/user/settings/security');
  }
});

router.post('/enable-2fa', isAuth, async (req, res) => {
  try {
    const { user } = req;
    const { step_verification: stepVerification } = req.body;

    switch (stepVerification) {
      case 'email':
        if (user.email_verification_code || !user.email) {
          throw new Error(
            'You need to add/verify your Email address to be able to do that',
          );
        }
        break;
      case 'pgp':
        if (!user.verifiedPgpKeys) {
          throw new Error(
            'You need to add/verify your Pgp key to be able to do that',
          );
        }
        break;
      default:
        throw new Error('Invalid 2 Step Verification');
    }

    user.settings.step_verification = stepVerification;

    await user.save();

    req.flash('success', '2 Step Verification Successfully Activated');
    res.redirect('/user/settings/security');
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/user/settings/security');
  }
});
router.post('/remove-2fa', isAuth, async (req, res) => {
  try {
    const { user } = req;

    user.settings.step_verification = undefined;

    await user.save();

    req.flash('success', '2 Step Verification Successfully Removed');
    res.redirect('/user/settings/security');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.put(
  '/change-password',
  isAuth,
  sanitizeChangePassword,
  async (req, res) => {
    try {
      const { user } = req;
      const { password, newPassword } = req.body;

      if (!bcrypt.compareSync(password, user.password)) throw new Error('Invalid Password');

      user.password = await bcrypt.hash(newPassword, 10);

      await user.save();

      req.flash('success', 'Password Successfully Changed');
      res.redirect('/user/settings/security');
    } catch (e) {
      req.flash('error', e.message);
      res.redirect('/user/settings/security');
    }
  },
);

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
      displayUsername,
      conversationPgp,
      messageExpiryDate,
      convoExpiryDate,
      includeTimestamps,
      messageView,
      deleteEmpty,
      customUsername,
      customPgp,
    } = req.body;

    user.settings.messageSettings.displayUsername = displayUsername;
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
    res.redirect('/user/settings/privacy');
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
    res.redirect('/user/settings/privacy');
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
    user.expire_at = user.settings.userExpiring
      ? user.settings.userExpiring * 86400000 + Date.now()
      : undefined;

    await user.save();

    req.flash('success', 'Account Settings successfully changed');
    res.redirect('/user/settings/privacy');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.post('/reset-privacy', isAuth, sanitizeQuerys, async (req, res) => {
  try {
    const { user } = req;
    const { type } = req.query;

    if (!['conversation', 'order', 'account', 'notifications'].includes(type)) throw new Error('Invalid Value');

    switch (type) {
      case 'conversation':
        user.settings.messageSettings.displayUsername = 'ownUsername';
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
      case 'notifications':
        user.settings.notificationsSettings = {
          recordNotification: true,
          expiryDate: 7,
          sentNotification: {
            orderStatusChange: true,
            newConversation: true,
            changeConversationSettings: true,
            deleteConversation: true,
            siteUpdate: true,
          },
        };
        break;
      default:
        user.settings.privateInfoExpiring = 7;
    }

    await user.save();

    res.redirect('/user/settings/privacy');
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.post(
  '/saved_product/:slug',
  isAuth,
  sanitizeParamsQuerys,
  async (req, res) => {
    try {
      const { url } = req.query;

      await Product.findOne({ slug: req.params.slug }).orFail(
        new Error('Invalid Product Slug'),
      );

      const user = await UserModel.findOne({ username: req.user.username });

      user.addRemoveSavedProducts(req.params.slug);

      await user.save();

      res.redirect(url ? `${url}` : '/settings?section=saved&productPage=1');
    } catch (e) {
      console.log(e);
      res.redirect('/404');
    }
  },
);

module.exports = router;
