const Product = require('../models/product');
const {compareArray, IsNot_Number, deleteImage, isEmail, isPgpKeys} = require('./function');

// Vars
const Banned_Username = ['admin', 'admins', 'system', 'systems', 'hidden', 'anonymous'];
const Conversation_Type = ['default', 'semi-hidden', 'hidden'];
const Rating_Possible = ['1', '2', '3', '4', '5'];
const List_Country = ['United-State', 'Canada'];
const List_Message_AutoDel = ['1', '3', '7', '30', 'never', 'seeing'];
const List_Information_AutoDel = ['0', '1', '3', '7', '30', 'never'];
const List_UserDel = ['7', '14', '30', '365', 'never'];
const category = [];


function Filter_Empty(value) {
   return value.filter((element) => element);
}

function validateNumber(value, inputName, {min = 1, max = 1e6, isRequired = true} = {}) {
   value = parseFloat(value)

   if (!isRequired && !value) return undefined;

   if (typeof value !== 'number' || isNaN(value)) throw new Error(`Invalid ${inputName} Data Type`);

   if (isRequired && !value) throw new Error(`The ${inputName} fields is Required`);
   if (value > max || value < min) throw new Error(`The ${inputName} can have a value ranging from ${min} to ${max}`);

   return value;
}

function ValidateText(value, inputName, {minlength = 3, maxlength = 50, isRequired = true} = {}) {
   if (!isRequired && !value) return undefined;

   if (typeof value !== 'string') throw new Error(`Invalid ${inputName} Data Type`);
   
   value = value.trim();

   if (isRequired && !value) throw new Error(`The ${inputName} fields is Required`);
   if (value.length > maxlength || value.length < minlength) throw new Error(`The ${inputName} need to be within ${minlength} to ${maxlength} characters longs`);
   return value;
}

// Function
function validateShippingOption(shippingOptionDecription, shippingOptionPrice) {
   const returnShippingOptions = [];

   for (let i = 0; i < shippingOptionDecription.length; i++) {
      if (shippingOptionDecription[i]) {
         shippingOptionDecription[i] = ValidateText(shippingOptionDecription[i], `Shipping Option Description #${i + 1}`, {minlength: 0, maxlength: 200, isRequired: false});

         console.log(shippingOptionPrice[i])
         shippingOptionPrice[i] = validateNumber(shippingOptionPrice[i], `Shipping Option Price #${i + 1}`, {min: 1, max: 1000, isRequired: false})
         if (!shippingOptionPrice[i]) shippingOptionPrice[i] = 0

         returnShippingOptions[i] = {option_description: shippingOptionDecription[i], option_price: shippingOptionPrice[i]};
      }
   }
   return returnShippingOptions;
}


function makeSelectionChoice(selectionOption, selectionPrice, selectionNum) {
   const selectionChoices = []

   for (let i = 0; i < selectionOption.length; i++) {
      if (selectionOption[i]) {
         selectionOption[i] = ValidateText(selectionOption[i], `Selection ${selectionNum} Option Description #${i + 1}`, {minlength: 0, maxlength: 200, isRequired: false});

         selectionPrice[i] = validateNumber(selectionPrice[i], `Selection ${selectionNum} Option Price #${i + 1}`, {min: 1, max: 1000, isRequired: false})
         if (!selectionPrice[i]) selectionPrice[i] = 0

         selectionChoices[i] = {choice_name: selectionOption[i], choice_price: selectionPrice[i]};
      }
   }
   return selectionChoices
}


function createSelection(selectionName, selectionOption, selectionPrice, selectionNum) {

   selectionName = ValidateText(selectionName, `Selection Name #${selectionNum}`, {minlength: 0, maxlength: 200, isRequired: false});

   if (!selectionName) return undefined

   const selectionChoice = makeSelectionChoice(selectionOption, selectionPrice, selectionNum)

   if (!selectionChoice.length) return undefined

   return {selection_name: selectionName, selection_choices: selectionChoice}
}



// Input Validation
function Validate_Login(req, res, next) {
   try {
      // Username
      req.body.username = ValidateText(req.body.username, 'Username', {minlength: 1, maxlength: 25});

      // Password
      req.body.password = ValidateText(req.body.password, 'Password', {minlength: 8, maxlength: 200});

      next();
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(req.url);
   }
};
function Validate_Register(req, res, next) {
   try {
      // Username
      req.body.username = ValidateText(req.body.username, 'Username', {minlength: 1, maxlength: 25});
      if (compareArray(Banned_Username, req.body.username.toLowerCase())) throw new Error(`You cannot use this Username`);

      // Password
      req.body.password = ValidateText(req.body.password, 'Password', {minlength: 8, maxlength: 200});

      // Confirm Password
      req.body.confirmPassword = ValidateText(req.body.confirmPassword, 'Confirm Password', {minlength: 8, maxlength: 200});
      if (req.body.confirmPassword !== req.body.password) throw new Error(`The Passwords doesnt Match`);

      next();
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(req.url);
   }
};
function Validate_Conversation(req, res, next) {
   try {
      // Message
      req.body.message = ValidateText(req.body.message, 'Message', {minlength: 2, maxlength: 1000});

      // Conversation Type
      if (!compareArray(Conversation_Type, req.body.type)) throw new Error();

      req.body.timestamps = req.body.timestamps ? true : undefined;
      //
      switch (req.body.pgpSettings) {
         case 'noPgp':
            req.body.pgpKeys = undefined;
            break;
         case 'ownPgp':
            req.body.pgpKeys = req.user.verifiedPgpKeys;
            break;
         case 'otherPgp':
            if (!isPgpKeys(req.body.otherPgpKeys)) throw new Error('The other Pgp Keys you provided is Invalid');
            req.body.pgpKeys = req.body.otherPgpKeys;
            break;
         default:
            req.body.pgpKeys = undefined;
      }

      next();
   } catch (e) {
      req.flash('error', e.message)
      res.redirect(`/profile/${req.params.user.username}?productPage=1&reviewPage=1`);
   }
};
function Validate_Message(req, res, next) {
   try {
      req.body.message = ValidateText(req.body.message, 'Message', {minlength: 2, maxlength: 1000});
      next();
   } catch (e) {
      res.redirect(`/404`);
   }
};

function Validate_Reviews(req, res, next) {
   try {
      req.body.review = ValidateText(req.body.review, 'Review', {minlength: 5, maxlength: 5000});

      if (!compareArray(Rating_Possible, req.body.note)) throw new Error();

      if (!compareArray(Conversation_Type, req.body.type)) throw new Error();

      next();
   } catch (e) {
      res.redirect(`/404`);
   }
};

function Validate_Profile(req, res, next) {
   try {
      req.body.job = ValidateText(req.body.job, 'Job', {minlength: 0, maxlength: 100, isRequired: false});

      req.body.description = ValidateText(req.body.description, 'Description', {minlength: 0, maxlength: 3000, isRequired: false});

      req.body.achievement = Filter_Empty(req.body.achievement);
      for (let i = 0; i < req.body.achievement.length; i++) {
         req.body.achievement[i] = ValidateText(req.body.achievement[i], 'Achievement #' + i, {minlength: 0, maxlength: 50, isRequired: false});
      }

      req.body.languages = Filter_Empty(req.body.languages);
      for (let i = 0; i < req.body.languages.length; i++) {
         req.body.languages[i] = ValidateText(req.body.languages[i], 'Languages #' + i, {minlength: 0, maxlength: 50, isRequired: false});
      }

      next();
   } catch (e) {
      if (req.file) {
         deleteImage(req.file.path);
      }
      req.flash('error', e.message);
      res.redirect('/edit-profile?productPage=1&reviewPage=1');
   }
};

function Validate_Product(req, res, next) {
   try {
      // Title
      req.body.title = ValidateText(req.body.title, 'Title', {minlength: 5, maxlength: 150});

      // Description
      req.body.description = ValidateText(req.body.description, 'Description', {minlength: 10, maxlength: 20000});

      // Message
      req.body.message = ValidateText(req.body.message, 'Message', {minlength: 0, maxlength: 1000, isRequired: false});

      //Allow Hidden
      req.body.allow_hidden = req.body.allow_hidden ? true : undefined;

      // Ship From
      if (!compareArray(List_Country, req.body.ship_from)) throw new Error('Selected Country Invalid');

      // Details
      req.body.details = Filter_Empty(req.body.details);
      for (let i = 0; i < req.body.details.length; i++) {
         req.body.details[i] = ValidateText(req.body.details[i], 'Details #' + i, {minlength: 0, maxlength: 100, isRequired: false});
      }

      // Availble Quantity
      req.body.available_qty = validateNumber(req.body.available_qty, 'Available', {min: 1, max: 1000, isRequired: false})

      req.body.max_order = validateNumber(req.body.max_order, 'Maximun per Order', {min: 1, max: req.body.available_qty ? req.body.available_qty : 1000, isRequired: false})

      // Quantity Settings
      req.body.qty_settings = {available_qty: req.body.available_qty, max_order: req.body.max_order};

      // Shipping Option
      req.body.shipping_option = validateShippingOption(req.body.describe_ship, req.body.price_ship);

      // Selection #1
      req.body.selection_1 = createSelection(req.body.selection_1_name, req.body.se_1_des, req.body.se_1_price, 1) 

      // Selection #2
      req.body.selection_2 = createSelection(req.body.selection_2_name, req.body.se_2_des, req.body.se_2_price, 2) 

      // Price
      req.body.price = validateNumber(req.body.price, 'Price')

      if (req.product.originalPrice && req.product.originalPrice !== req.body.price) throw new Error('You cant change the Price of your Product while it is still on sale');

      req.body.salesPrice = validateNumber(req.body.salesPrice, 'Sales Price', {min: 1, max: req.body.price - 1, isRequired: false})

      req.body.salesDuration = validateNumber(req.body.salesDuration, 'Sales Duration', {min: 1, max: 30, isRequired: false})
      if (req.body.salesDuration && !req.body.salesPrice) req.body.salesPrice = 1
      
      if (req.product.originalPrice) {
         if (req.product.price !== req.body.salesPrice) throw new Error('You cant change the Price of your Sales while on Sales');
         if (req.product.salesDuration !== req.body.salesDuration) throw new Error('You cant change the Duration of your Sales while on Sales');
         req.body.stop_sales = req.body.stop_sales ? true : false;
      }

      // Status
      if (!compareArray(['online', 'offline'], req.body.status)) throw new Error(`Invalid Status Value`);

      next();
   } catch (e) {
      console.log(e)
      let url = `${req.url}`;

      if (req.file) {
         deleteImage(req.file.path);
      }
      req.flash('error', e.message);
      res.redirect(url);
   }
};

function Validate_Change_Password(req, res, next) {
   try {
      // Old Password
      req.body.password = ValidateText(req.body.password, 'Password', {minlength: 8, maxlength: 200});

      // New Password
      req.body.newPassword = ValidateText(req.body.newPassword, 'New Password', {minlength: 8, maxlength: 200});

      // Confirm Password
      req.body.confirmPassword = ValidateText(req.body.confirmPassword, 'Confirm New Password', {minlength: 8, maxlength: 200});
      if (req.body.confirmPassword !== req.body.newPassword) throw new Error(`The new Password doesnt Match`);

      next();
   } catch (e) {
      req.flash('error', e.message);
      res.redirect( `/settings?section=security`);
   }
};

function Validate_AutoDel_Settings(req, res, next) {
   try {
      if (!compareArray(List_Message_AutoDel, req.body.messages)) throw new Error('The Selected Auto Delete Message Settings is Invalid');
      if (!compareArray(List_Information_AutoDel, req.body.informations)) throw new Error('The Selected Auto Delete Information Settings is Invalid');
      if (!compareArray(List_UserDel, req.body.userDel)) throw new Error('The User Auto Delete Settings is Invalid');

      if (req.body.messages === 'never') req.body.messages = undefined;
      if (req.body.informations === 'never') req.body.informations = undefined;
      if (req.body.userDel === 'never') req.body.userDel = undefined;

      next();
   } catch (e) {
      let url = `/settings?section=privacy`;
      req.flash('error', e.message);
      res.redirect(url);
   }
};

function Validate_SearchInput(req, res, next) {
   try {
      // Search
      req.body.search = ValidateText(req.body.search, 'Search', {minlength: 0, maxlength: 500, isRequired: false});

      //Category
      if (compareArray(category, req.body.category)) throw new Error('Selected Category Invalid');

      next();
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/products?productPage=1`);
   }
};

function Validate_Code(req, res, next) {
   try {
      const lengths = req.query.type === 'email' ? [9, 9] : [9, 300];

      req.body.code = ValidateText(req.body.code, 'Code', {minlength: lengths[0], maxlength: lengths[1]});

      next();
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/2fa?type=${req.query.type}`);
   }
};


function validateContactUs(req, res, next) {
   try {
      req.body.username = req.body.username ? req.user.username : undefined

      if (!compareArray(['feedback', 'bug', 'help', 'other'], req.body.reason)) throw new Error('Invalid Reason');

      req.body.message = ValidateText(req.body.message, 'Message', {minlength: 10, maxlength: 3000});

      if (req.body.email) {
         if (!isEmail(req.body.email)) throw new Error('The Email field must be a valid Email');
      } else req.body.email = undefined;

      next();
   } catch (e) {
      req.flash('error', e.message);
      res.redirect('/contactus');
   }
};

function validateResolveReport(req, res, next) {
   try {
      req.body.message = ValidateText(req.body.message, 'Message to the vendor', {minlength: 10, maxlength: 3000});

      if (!req.body.ban) {
         req.body.ban = undefined;
         req.body.banReason = undefined;
      } else {
         req.body.ban = true;
         req.body.banReason = ValidateText(req.body.banReason, 'Reason of Banning', {minlength: 10, maxlength: 3000});
      }

      next();
   } catch (e) {
      console.log(e);
      req.flash('error', e.message);
      res.redirect('/reports');
   }
};

function validateReports(req, res, next) {
   try {
      req.body.username = req.body.username ? req.user.username : undefined

      if (!compareArray(['scam', 'blackmail', 'information', 'other'], req.body.reason)) throw new Error('Invalid Reason');

      req.body.message = ValidateText(req.body.message, 'Message', {minlength: 10, maxlength: 3000});

      req.params.id = ValidateText(req.params.id, 'Id', {minlength: 3, maxlength: 200});

      next();
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
};


// Make Order Validation
function isSelectedShippingValid(selectedOption, availableOption) {
   for(let i = 0; i < availableOption.length; i++) {
      if (selectedOption === availableOption[i].option_description) return {option_name: availableOption[i].option_description, option_price: availableOption[i].option_price}
   }

   throw new Error('Invalid Selected Shipping Option')
}


function isSelectedSelectionValid(selectedSelection, availableSelection) {
for(let i = 0; i < availableSelection.selection_choices.length; i++) {
   
   if (selectedSelection === availableSelection.selection_choices[i].choice_name) return {
      selection_name: availableSelection.selection_name,
      selected_choice: {
         choice_name: availableSelection.selection_choices[i].choice_name,
         choice_price: availableSelection.selection_choices[i].choice_price,
      },
   };
}
throw new Error('Invalid Selected Selection')
}

async function Validate_OrderCustomization(req, res, next) {
   try {

      req.product = await Product.findOne({slug: req.params.slug, status: 'online'}).orFail(new Error('Invalid Slug Params'));

      if (req.user.username === req.product.vendor) throw new Error('You cant Buy Your Own Product');

      if (req.product.available_qty == 0) throw new Error('This Product is Sold Out');

      req.body.qty = validateNumber(req.body.qty, 'Quantity', {max: req.product.qty_settings?.max_order ? req.product.qty_settings?.max_order : req.product.qty_settings?.available_qty})

      // Shipping Option
      if (req.body.shipping_option) req.body.shipping_option = isSelectedShippingValid(req.body.shipping_option, req.product.shipping_option);

      // Selection #1
      if (req.body.selection_1 && req.product.selection_1) req.body.selection_1 = isSelectedSelectionValid(req.body.selection_1, req.product.selection_1);

      // Selection #2
      if (req.body.selection_2 && req.product.selection_2) req.body.selection_2 = isSelectedSelectionValid(req.body.selection_2, req.product.selection_2);

      next();
   } catch (e) {
      console.log(e);
      req.flash('error', e.message);
      res.redirect(`/order/${req.params.slug}`);
   }
};

function isObject(value) {
   if (value instanceof Object) {
      if (value instanceof Array) return undefined
      else return true
   }
   return undefined
}

function sanitizeInput(value) {
   if (!value) throw new Error()
   if (typeof(value) !== 'string') throw new Error()
   if (value.length > 200) throw new Error()
   return
}

function sanitizeObject(object) {
   if (!isObject(object)) throw new Error()

   const querysValues = Object.keys(object)

   for(let i = 0; i < querysValues.length; i++) {
      sanitizeInput(object[querysValues[i]])
   }
   return 
}

function sanitizeQuerys(req, res, next) {
   try { 
      if (req.query) sanitizeObject(req.query)

      next()
   } catch (e) {
      console.log('Invalid Query')
      res.redirect('/404')
   }
}

function sanitizeParams(req, res, next) {
   try { 
      if (req.params)sanitizeObject(req.params)

      next()
   } catch (e) {
      console.log('Invalid Params')
      res.redirect('/404')
   }
}

function sanitizeParamsQuerys(req, res, next) {
   try { 
      if (req.query)sanitizeObject(req.query)
      if (req.params)sanitizeObject(req.params)

      next()
   } catch (e) {
      console.log('Invalid Query or Params')
      res.redirect('/404')
   }
}

module.exports = {sanitizeQuerys, sanitizeParams, sanitizeParamsQuerys, Validate_OrderCustomization, validateReports, validateResolveReport, validateContactUs, Validate_Code, Validate_SearchInput, Validate_AutoDel_Settings, Validate_Change_Password, Validate_Product, Validate_Profile, Validate_Reviews, Validate_Message, Validate_Conversation, Validate_Register, Validate_Login}
