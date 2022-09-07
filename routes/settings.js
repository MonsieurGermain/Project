const express = require('express');
const router = express.Router();
const {Need_Authentification} = require('../middlewares/authentication');
const User = require('../models/user');
const Product = require('../models/product');
const Conversation = require('../models/conversation');
const bcrypt = require('bcrypt');
const {
   Validate_Change_Password,
   paramsUsername_isReqUsername,
} = require('../middlewares/validation');
const {paginatedResults, RandomNumber, RandomList_ofWords, isEmail, isPgpKeys, isMoneroAddress} = require('../middlewares/function');


function validateData(value, acceptedValues) {
   for (let i = 0; i < acceptedValues.length; i++) {
      if (acceptedValues[i] === value) return true;
   }
   return;
}


router.get('/settings/:username', Need_Authentification, paramsUsername_isReqUsername,
   async (req, res) => {
      try {
         if (!validateData(req.query.section, [undefined, 'security', 'privacy', 'payment', 'saved'])) throw new Error('Invalid Section Query');

         const {user} = req;

         let paginatedProducts;
         if (req.query.section === 'saved') paginatedProducts = await paginatedResults(Product, {slug: {$in: user.saved_product}, status: 'online'}, {page: req.query.productPage, limit: 24}); 

         res.render('settings', {user, paginatedProducts});
      } catch (e) {
         console.log(e);
         res.redirect('/404');
      }
   }
);

router.post('/add-xmr-address', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;

      const moneroAddress = req.body.xmr_address.trim();

      if (!isMoneroAddress(moneroAddress)) throw new Error('Invalid Monero Address');

      const successMessage = user.moneroAddress ? 'Monero Address Successfully Changed' : 'Monero Address Successfully Added';

      user.xmr_address = moneroAddress;

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
      const moneroRefundAddress = req.body.xmrRefundAddress.trim();

      if (!isMoneroAddress(moneroRefundAddress)) throw new Error('Invalid Monero Address')

      const successMessage = user.moneroRefundAddress ? 'Monero Address Successfully Changed' : 'Monero Address Successfully Added';

      user.xmrRefundAddress = moneroRefundAddress;

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


      switch(addressType) {
         case 'personal':
            user.xmr_address = undefined;
            await user.offlineAllUserProducts();
            req.flash('warning', 'Your Monero Address as been Deleted, all of your Product are now offline since you dont have a Monero Address');
         break
         case 'refund':
            user.xmrRefundAddress = undefined;
            req.flash('success', 'Your Refund Address as been Deleted');
         break
         default:
            throw new Error('Invalid Query');
      }

      await user.save();

      res.redirect(`/settings/${req.user.username}?section=payment`);
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/settings/${req.user.username}?section=payment`);
   }
});


async function updateConversationPgp(username, newPgp) {
   const conversations = await Conversation.findAllUserConversations(username);

   for (let i = 0; i < conversations.length; i++) {
      conversations[i].updateNewPgp(username, newPgp);
   }
}
router.post('/add-pgp', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const {pgp} = req.body;

      if (!isPgpKeys(pgp)) throw new Error('Invalid Pgp Keys');

      user.pgp_keys = pgp;
      user.verifiedPgpKeys = undefined;
      user.pgp_keys_verification_words = RandomList_ofWords(12);
      user.pgp_keys_verification_words_encrypted = user.pgp_keys_verification_words; // Encrypt It with user pgp

      await user.save();

      console.log(user.pgp_keys_verification_words)

      req.flash('success', 'A new Pgp Keys as Been added, you just need Verify it');
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/settings/${req.user.username}?section=security`);
   }
});
router.post('/delete-pgp', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;

      user.pgp_keys = undefined;
      user.verifiedPgpKeys = undefined;
      user.pgp_keys_verification_words = undefined;
      user.pgp_keys_verification_words_encrypted = undefined;
      user.settings.step_verification = 'pgp' ? undefined : user.settings.step_verification;

      await user.save();

      req.flash('success', 'Pgp Keys Successfully Deleted');
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});
router.post('/verify-pgp', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const {pgp_verification} = req.body

      if (!pgp_verification || pgp_verification !== user.pgp_keys_verification_words) throw new Error('Invalid Code... try Again');

      user.verifiedPgpKeys = user.pgp_keys;
      user.pgp_keys = undefined;
      user.pgp_keys_verification_words = undefined;
      user.pgp_keys_verification_words_encrypted = undefined;

      await updateConversationPgp(user.username, user.verifiedPgpKeys);
      await user.save();

      req.flash('success', 'Pgp Successfully Verified');
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});



router.post('/add-email', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const {email} = req.body

      if (!isEmail(email)) throw new Error('This Email Address is Invalid')

      user.email = email;

      user.email_verification_code = RandomNumber(6);

      // Send Email Containning Verification Code
      console.log(`The Verification Code is: ${user.email_verification_code}`);

      await user.save();

      req.flash('success', 'Email Address Successfully Added');
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/settings/${req.user.username}?section=security`);
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
      res.redirect('/404');
   }
});
router.post('/confirm-email', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const confirmation_code = req.body.confirmation_code.trim();

      if (typeof(confirmation_code) !== 'string' || confirmation_code.length !== 6 || user.email_verification_code !== confirmation_code) throw new Error('Invalid Confirmation Code, try Again');

      user.email_verification_code = undefined;

      await user.save();

      req.flash('success', 'Email Successfully Verified');
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/settings/${req.user.username}?section=security`);
   }
});
router.post('/resend-email-verification', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;

      if (!user.email || !user.email_verification_code) throw new Error()

      user.email_verification_code = RandomNumber(6);
      console.log(user.email_verification_code)

      // Resend Email with new Confirmation Code

      await user.save();

      req.flash('success', 'Verifaction Code Resended');
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      res.redirect(`/settings/${req.user.username}?section=security`);
   }
});

router.post('/enable-2fa', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const {step_verification}= req.body;

      switch(step_verification) {
         case 'email':
            if (user.email_verification_code || !user.email) throw new Error('You need to add/verify your Email address to be able to do that');
         break
         case 'pgp':
            if (!user.verifiedPgpKeys) throw new Error('You need to add/verify your Pgp key to be able to do that');
         break
         default : 
          throw new Error('Invalid 2 Step Verification');
      }

      user.settings.step_verification = step_verification;

      await user.save();

      req.flash('success', '2 Step Verification Successfully Activated');
      res.redirect(`/settings/${user.username}?section=security`);
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/settings/${req.user.username}?section=security`);
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
      res.redirect(`/404`);
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
      await req.user.deleteUser();

      res.redirect('/logout');
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});

router.post('/conversation-settings', Need_Authentification, async (req, res) => {
   try {
      const {user} = req;
      const {autoDeleteConversation, deleteEmptyConversation, recordSeeingMessage} = req.body;

      if (!validateData(autoDeleteConversation, ['never', '1', '3', '7', '30'])) throw new Error('Invalid Value');
      if (!validateData(deleteEmptyConversation, ['true', 'false'])) throw new Error('Invalid Value');
      if (!validateData(recordSeeingMessage, ['true', 'false'])) throw new Error('Invalid Value');

      user.settings.messageExpiring = autoDeleteConversation !== 'never' ? autoDeleteConversation : undefined;
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

      if (!validateData(autoDeleteProvidedInfo, ['never', '-1', '1', '3', '7', '30'])) throw new Error('Invalid Value');

      user.settings.privateInfoExpiring = autoDeleteProvidedInfo !== 'never' ? autoDeleteProvidedInfo : undefined;

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

      user.settings.userExpiring = autoDeleteAccount !== 'never' ? autoDeleteAccount : undefined;
      user.expire_at = user.settings.userExpiring ?  user.settings.userExpiring * 86400000 + Date.now() : undefined;

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
         user.settings.messageExpiring = 7;
         user.settings.deleteEmptyConversation = true;
         user.settings.recordSeeingMessage = false;
      }
      if (type === 'account') {
         user.settings.userExpiring = undefined; // ?
         user.expire_at = undefined;
      }
      if (type === 'order') user.settings.privateInfoExpiring = 7;

      await user.save();

      res.redirect(`/settings/${user.username}?section=privacy`);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
});

router.post('/saved_product/:slug', Need_Authentification, async (req, res) => {
   try {
      const {url, productPage} = req.query

      if (!url) url = '/';
      if (typeof(url) !== 'string') throw new Error('Invalid Query Url');

      await Product.findOne({slug: req.params.slug}).orFail(new Error('Invalid Product Slug'))

      const user = await User.findOne({username: req.user.username});

      user.Add_Remove_Saved_Product(req.params.slug);

      await user.save();
      if (productPage) res.redirect(`/settings/${req.user.username}?section=saved&productPage=${productPage}`);
      else res.redirect(`${url}`);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
}); // ? Tf are those redirect I need to find another way

module.exports = router;
