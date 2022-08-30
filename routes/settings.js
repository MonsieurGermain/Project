const express = require('express');
const router = express.Router();
const {Need_Authentification} = require('../middlewares/authentication');
const User = require('../models/user');
const Product = require('../models/product');
const bcrypt = require('bcrypt');
const {
   ValidateValueByChoice,
   Validate_Change_Password,
   paramsUsername_isReqUsername,
   FetchData,
   Validate_Query_Url,
   Validate_Email,
   Validate_Pgp,
   Validate_Pgp_Verification,
} = require('../middlewares/validation');
const {paginatedResults, RandomNumber, RandomList_ofWords} = require('../middlewares/function');

router.get(
   '/settings/:username',
   Need_Authentification,
   paramsUsername_isReqUsername,
   ValidateValueByChoice(['query', 'section'], [undefined, 'security', 'privacy', 'payment', 'saved']),
   async (req, res) => {
      try {
         const {user} = req;

         let paginatedProducts;
         if (req.query.section === 'saved')
            paginatedProducts = await paginatedResults(Product, {slug: {$in: user.saved_product}, status: 'online'}, {page: req.query.productPage, limit: 24});

         res.render('settings', {user, paginatedProducts});
      } catch (e) {
         console.log(e);
         res.redirect('/error');
      }
   }
);

router.post('/add-xmr-address', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const xmr_address = req.body.xmr_address.trim();

      if (xmr_address.length > 106 || xmr_address.length < 95) throw new Error('Invalid Monero Address');

      const successMessage = user.xmr_address ? 'Monero Address Successfully Changed' : 'Monero Address Successfully Added';

      user.xmr_address = xmr_address;

      await user.save();

      req.flash('success', successMessage);
      res.redirect(`/settings/${req.user.username}?section=payment`);
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/settings/${req.user.username}?section=payment`);
   }
});
router.post('/add-xmr-refund-address', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const xmrRefundAddress = req.body.xmrRefundAddress.trim();

      if (xmrRefundAddress.length > 106 || xmrRefundAddress.length < 95) throw new Error('Invalid Monero Address');

      const successMessage = user.xmrRefundAddress ? 'Monero Address Successfully Changed' : 'Monero Address Successfully Added';

      user.xmrRefundAddress = xmrRefundAddress;

      await user.save();

      req.flash('success', successMessage);
      res.redirect(`/settings/${req.user.username}?section=payment`);
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/settings/${req.user.username}?section=payment`);
   }
});
router.post('/delete-address', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const {addressType} = req.query;

      if (addressType !== 'personal' && addressType !== 'refund') throw new Error('Invalid Query');

      if (addressType === 'personal') {
         user.xmr_address = undefined;
         await user.offlineAllUserProducts();
         req.flash('warning', 'Your Monero Address as been Deleted, all of your Product are now offline since you dont have a Monero Address');
      } else {
         user.xmrRefundAddress = undefined;
         req.flash('success', 'Your Refund Address as been Deleted');
      }

      await user.save();

      res.redirect(`/settings/${req.user.username}?section=payment`);
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/settings/${req.user.username}?section=payment`);
   }
});

router.post('/add-pgp', Need_Authentification, Validate_Pgp, async (req, res) => {
   try {
      const {user} = req;
      const {pgp} = req.body;
      let flash_message;

      if (pgp) {
         user.pgp_keys = pgp;
         user.pgp_keys_verification_words = RandomList_ofWords(12);
         user.pgp_keys_verification_words_encrypted = user.pgp_keys_verification_words; // Encrypt It with user pgp
         flash_message = 'A new Pgp Keys as Been added, you just need Verify it';
      } else {
         user.pgp_keys = undefined;
         user.pgp_keys_verification_words = undefined;
         user.pgp_keys_verification_words_encrypted = undefined;
         flash_message = 'Your Pgp Keys as been Deleted';
      }

      // Send Email Containning Verification Code
      await user.save();

      req.flash('success', flash_message);
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      console.log(e);
      res.redirect('/error');
   }
});
router.post('/delete-pgp', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;

      user.pgp_keys = undefined;
      user.pgp_keys_verification_words = undefined;
      user.pgp_keys_verification_words_encrypted = undefined;
      user.settings.step_verification = 'pgp' ? undefined : user.settings.step_verification;

      await user.save();

      req.flash('success', 'Pgp Keys Successfully Deleted');
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      console.log(e);
      res.redirect('/error');
   }
});
router.post('/verify-pgp', Need_Authentification, Validate_Pgp_Verification, async (req, res) => {
   try {
      const {user} = req;

      user.pgp_keys_verification_words = undefined;
      user.pgp_keys_verification_words_encrypted = undefined;

      await user.save();

      req.flash('success', 'Pgp Successfully Verified');
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      console.log(e);
      res.redirect('/error');
   }
});

router.post('/add-email', Need_Authentification, Validate_Email, async (req, res) => {
   try {
      const {user} = req;
      const old_email = user.email;
      let flash_message;

      user.email = req.body.email;

      if (!user.email && !old_email) flash_message = 'No Email Added';
      else if (!user.email) flash_message = 'Email Address Removed';
      else if (user.email === old_email) flash_message = 'You already have entered this Email Address';
      else flash_message = 'Please Go check your Email inbox to confirm your new Email Address';

      if (user.email && old_email !== user.email) {
         user.email_verification_code = RandomNumber(6);
         console.log(`The Verification Code is: ${user.email_verification_code}`);
      }
      if (!user.email && user.email_verification_code) user.email_verification_code = undefined;
      if (!user.email && user.settings.step_verification) {
         user.settings.step_verification = undefined;
      }

      // Send Email Containning Verification Code

      await user.save();

      req.flash('success', flash_message);
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      console.log(e);
      res.redirect('/error');
   }
});
router.post('/delete-email', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;

      user.email = undefined;
      user.email_verification_code = undefined;
      user.settings.step_verification = 'email' ? undefined : user.settings.step_verification;

      await user.save();

      req.flash('success', 'Email Address Successfully Deleted');
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      console.log(e);
      res.redirect('/error');
   }
});
router.post('/confirm-email', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const confirmation_code = req.body.confirmation_code.trim();
      let flash_message;

      if (!user.email_verification_code) throw new Error('No Email to verify');

      if (user.email_verification_code === confirmation_code) {
         user.email_verification_code = undefined;
         flash_message = {type: 'success', msg: 'Email Successfully Verified'};
      } else {
         flash_message = {type: 'error', msg: 'Invalid Confirmation Code'};
      }

      await user.save();

      req.flash(flash_message.type, flash_message.msg);
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/settings/${req.user.username}?section=security`);
   }
});
router.post('/resend-email-verification', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;

      if (user.email && user.email_verification_code) user.email_verification_code = RandomNumber(6);
      else throw new Error('No Email addres to verified');

      // Resend Email with new Confirmation Code

      await user.save();

      req.flash('success', 'Verifaction Code Resended');
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      console.log(e);
      res.redirect(`/settings/${req.user.username}?section=security`);
   }
});

router.post('/enable-2fa', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const step_verification = req.body.step_verification;

      // Validation
      if (step_verification === 'email') {
         if (user.email_verification_code || !user.email) throw new Error('You cant Add Email 2 Step Verification');
      } else if (step_verification === 'pgp') {
         if (user.pgp_keys_verification_words || !user.pgp_keys) throw new Error('You cant Add Email 2 Step Verification');
      } else throw new Error('Invalid Value');

      let flash_message;
      if (user.settings.step_verification) flash_message = '2 Step Verification Successfully Changed';
      else flash_message = '2 Step Verification Successfully Added';

      user.settings.step_verification = step_verification;

      await user.save();

      req.flash('success', flash_message);
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      console.log(e);
      res.redirect(`/error`);
   }
});
router.post('/remove-2fa', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;

      user.settings.step_verification = undefined;

      await user.save();

      req.flash('success', '2 Step Verification Successfully Removed');
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      console.log(e);
      res.redirect(`/error`);
   }
});

router.put('/change-password/:username', Need_Authentification, paramsUsername_isReqUsername, Validate_Change_Password, async (req, res) => {
   try {
      const {user} = req;
      const {password, newPassword} = req.body;

      if (!bcrypt.compareSync(password, user.password)) throw new Error('Invalid Password');

      user.password = await bcrypt.hash(newPassword, 10);

      await user.save();

      req.flash('success', 'Password Successfully Changed');
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/settings/${req.user.username}?section=security`);
   }
});

router.delete('/delete-user/:username', Need_Authentification, paramsUsername_isReqUsername, async (req, res) => {
   try {
      const {user} = req;

      await user.deleteUser();

      res.redirect('/logout');
   } catch (e) {
      console.log(e);
      res.redirect('/error');
   }
});

function validateData(value, acceptedValues) {
   for (let i = 0; i < acceptedValues.length; i++) {
      if (acceptedValues[i] === value) return true;
   }
   return;
}
router.post('/conversation-settings', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const {autoDeleteConversation, deleteEmptyConversation, recordSeeingMessage} = req.body;

      if (!validateData(autoDeleteConversation, ['never', '1', '3', '7', '30'])) throw new Error('Invalid Value');
      if (!validateData(deleteEmptyConversation, ['true', 'false'])) throw new Error('Invalid Value');
      if (!validateData(recordSeeingMessage, ['true', 'false'])) throw new Error('Invalid Value');

      user.settings.message_expiring = autoDeleteConversation;
      user.settings.deleteEmptyConversation = deleteEmptyConversation === 'true' ? true : false;
      user.settings.recordSeeingMessage = recordSeeingMessage === 'true' ? true : false;

      await user.save();

      res.redirect(`/settings/${user.username}?section=privacy`);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});
router.post('/order-settings', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const {autoDeleteProvidedInfo} = req.body;

      if (!validateData(autoDeleteProvidedInfo, ['never', '0', '1', '3', '7', '30'])) throw new Error('Invalid Value');

      user.settings.info_expiring = autoDeleteProvidedInfo;

      await user.save();

      res.redirect(`/settings/${user.username}?section=privacy`);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});
router.post('/account-settings', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const {autoDeleteAccount} = req.body;

      if (!validateData(autoDeleteAccount, ['never', '7', '14', '30', '365'])) throw new Error('Invalid Value');

      user.settings.user_expiring = autoDeleteAccount;
      if (user.settings.user_expiring) user.expire_at = Date.now() + user.settings.user_expiring * 86400000;
      else user.expire_at = undefined;

      await user.save();

      res.redirect(`/settings/${user.username}?section=privacy`);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});
router.post('/reset-privacy', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const {type} = req.query;

      if (!validateData(type, ['conversation', 'order', 'account'])) throw new Error('Invalid Value');

      if (type === 'conversation') {
         user.settings.message_expiring = '7';
         user.settings.deleteEmptyConversation = true;
         user.settings.recordSeeingMessage = false;
      }
      if (type === 'account') {
         user.settings.user_expiring = undefined;
         user.expire_at = undefined;
      }
      if (type === 'order') user.settings.info_expiring = '7';

      await user.save();

      res.redirect(`/settings/${user.username}?section=privacy`);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});

router.post('/saved_product/:slug', Need_Authentification, Validate_Query_Url, FetchData(['params', 'slug'], Product, 'slug', 'product'), async (req, res) => {
   try {
      const user = await User.findOne({username: req.user.username});
      user.Add_Remove_Saved_Product(req.params.slug);

      await user.save();
      if (req.query.productPage) res.redirect(`/settings/${req.user.username}?section=saved&productPage=${req.query.productPage}`);
      else res.redirect(`${req.query.url}`);
   } catch (e) {
      console.log(e);
      res.redirect('/error');
   }
});

module.exports = router;
