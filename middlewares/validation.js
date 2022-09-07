const Product = require('../models/product');
const Conversation = require('../models/conversation');
const Order = require('../models/order');
const User = require('../models/user');
const {Is_Bigger, compareArray, IsNot_Number, deleteImage, isEmail, validatePgpKeys} = require('./function');

// Vars
const Banned_Username = ['admin', 'admins', 'system', 'systems', 'hidden', 'anonymous'];
const Conversation_Type = ['default', 'semi-hidden', 'hidden'];
const Rating_Possible = ['1', '2', '3', '4', '5'];
const List_Country = ['United-State', 'Canada'];
const List_Message_AutoDel = ['1', '3', '7', '30', 'never', 'seeing'];
const List_Information_AutoDel = ['0', '1', '3', '7', '30', 'never'];
const List_UserDel = ['7', '14', '30', '365', 'never'];
const category = [];

// Function
function Check_If_Selected_ShippingOptions_Valid(selected_opt, available_opt) {
   let taken_opt;
   for (let i = 0; i < available_opt.length; i++) {
      if (selected_opt === available_opt[i].option_description) {
         taken_opt = {option_name: available_opt[i].option_description, option_price: available_opt[i].option_price};
         break;
      }
   }
   return taken_opt;
}
function Get_Selection(selected_select, available_select) {
   let taken_select;

   for (let i = 0; i < available_select.selection_choices.length; i++) {
      if (available_select.selection_choices[i].choice_name === selected_select) {
         taken_select = {
            selection_name: available_select.selection_name,
            selected_choice: {
               choice_name: available_select.selection_choices[i].choice_name,
               choice_price: available_select.selection_choices[i].choice_price,
            },
         };
         break;
      }
   }
   return taken_select;
}
function validateShippingOption(shippingOption, shippingPrices) {
   const returnShippingOptions = [];

   for (let i = 0; i < shippingOption.length; i++) {
      if (shippingOption[i]) {
         shippingOption[i] = ValidateText(shippingOption[i], 'Shipping Option Description #' + i, {minlength: 0, maxlength: 200, isRequired: false});

         if (IsNot_Number(shippingPrices[i])) shippingPrices[i] = 0;
         else if (shippingPrices[i] > 1000) shippingPrices[i] = 1000;

         returnShippingOptions.push({option_description: shippingOption[i], option_price: shippingPrices[i]});
      }
   }

   return returnShippingOptions;
}

function Make_Selection(options, prices) {
   const selection = [];
   for (let i = 0; i < options.length; i++) {
      if (options[i]) selection.push({choice_name: options[i], choice_price: prices[i] ? prices[i] : 0});
   }
   return selection;
}
function Filter_Empty(value) {
   return value.filter((element) => element);
}
function Replace_Empty(value) {
   for (let i = 0; i < value.length; i++) {
      if (!value[i]) value[i] = '0';
   }
   return value;
}

function ValidateText(value, name, {minlength = 3, maxlength = 50, isRequired = true} = {}) {
   if (!isRequired && !value) return undefined;

   if (typeof value !== 'string') throw new Error(`Invalid ${name} Data Type`);
   value = value.trim();

   if (isRequired && !value) throw new Error(`The ${name} fields is Required`);
   if (value.length > maxlength || value.length < minlength) throw new Error(`The ${name} need to be within ${minlength} to ${maxlength} characters longs`);
   return value;
}

async function Fetch_inDatabase(model, query, value) {
   if (query) return await model.findOne({[query]: value});
   else return await model.findById(value);
}

exports.ValidateNumber = (path, {min = 1, max = 99999} = {}) => {
   let value = req[path[0]][path[1]];
   value = parseInt(value);

   if (typeof value !== 'number') value = 1;
   if (value > max) value = max;
   if (value < min) value = min;

   req[path[0]][path[1]] = value;

   next();
};

// Input Validation
exports.Validate_Login = (req, res, next) => {
   try {
      // Username
      req.body.username = ValidateText(req.body.username, 'Username');

      // Password
      req.body.password = ValidateText(req.body.password, 'Password', {minlength: 8, maxlength: 200});

      next();
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(req.url);
   }
};
exports.Validate_Register = (req, res, next) => {
   try {
      // Username
      req.body.username = ValidateText(req.body.username, 'Username');
      if (compareArray(Banned_Username, req.body.username.toLowerCase())) throw new Error(`You cannot use this Username`);

      // Password
      req.body.password = ValidateText(req.body.password, 'Password', {minlength: 8, maxlength: 200});

      // Confirm Password
      if (typeof req.body.confirmPassword !== 'string') throw new Error(`Invalid Confirm Password Data Type`);
      req.body.confirmPassword = req.body.confirmPassword.trim();
      if (req.body.confirmPassword !== req.body.password) throw new Error(`The Passwords doesnt Match`);

      next();
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(req.url);
   }
};
exports.Validate_Conversation = (req, res, next) => {
   try {
      // Message
      req.body.message = ValidateText(req.body.message, 'Message', {minlength: 2, maxlength: 1000});

      // Conversation Type
      if (!compareArray(Conversation_Type, req.body.type)) throw new Error();

      if (req.body.timestamps) req.body.timestamps = true;
      //
      switch (req.body.pgpSettings) {
         case 'noPgp':
            req.body.pgpKeys = undefined;
            break;
         case 'ownPgp':
            req.body.pgpKeys = req.user.verifiedPgpKeys;
            break;
         case 'otherPgp':
            if (!validatePgpKeys(req.body.otherPgpKeys)) throw new Error('The other Pgp Keys you provided is Invalid');
            req.body.pgpKeys = req.body.otherPgpKeys;
            break;
         default:
            req.body.pgpKeys = undefined;
      }

      next();
   } catch (e) {
      res.redirect(`/404`);
   }
};
exports.Validate_Message = (req, res, next) => {
   try {
      req.body.message = ValidateText(req.body.message, 'Message', {minlength: 2, maxlength: 1000});
      next();
   } catch (e) {
      res.redirect(`/404`);
   }
};

exports.Validate_Reviews = (req, res, next) => {
   try {
      // Review
      req.body.review = ValidateText(req.body.review, 'Review', {minlength: 5, maxlength: 5000});

      //Note
      if (!compareArray(Rating_Possible, req.body.note)) throw new Error();
      req.body.note = parseFloat(req.body.note);

      //Type
      if (!compareArray(Conversation_Type, req.body.type)) throw new Error();

      next();
   } catch (e) {
      res.redirect(`/404`);
   }
};
exports.Validate_Profile = (req, res, next) => {
   try {
      // Job
      if (req.body.job) req.body.job = ValidateText(req.body.job, 'Job', {minlength: 0, maxlength: 100, isRequired: false});
      else req.body.job = undefined;

      //Description
      if (req.body.description) req.body.description = ValidateText(req.body.description, 'Description', {minlength: 0, maxlength: 3000, isRequired: false});
      else req.body.description = undefined;

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
      const splited_url = req.url.split('?');
      let url = `${splited_url[0]}`;

      if (req.file) {
         deleteImage(req.file.path);
      }
      req.flash('error', e.message);
      res.redirect(url);
   }
};
exports.Validate_Product = (req, res, next) => {
   try {
      // Title
      req.body.title = ValidateText(req.body.title, 'Title', {minlength: 5, maxlength: 150});

      // Description
      req.body.description = ValidateText(req.body.description, 'Description', {minlength: 10, maxlength: 20000});

      // Message
      req.body.message = ValidateText(req.body.message, 'Message', {minlength: 0, maxlength: 500, isRequired: false});

      //Allow Hidden
      if (req.body.allow_hidden) req.body.allow_hidden = true;

      // Ship From
      if (!compareArray(List_Country, req.body.ship_from)) throw new Error('Selected Country Invalid');

      // Details
      req.body.details = Filter_Empty(req.body.details);
      for (let i = 0; i < req.body.details.length; i++) {
         req.body.details[i] = ValidateText(req.body.details[i], 'Details #' + i, {minlength: 0, maxlength: 100, isRequired: false});
      }

      // Availble Quantity
      if (req.body.available_qty) {
         if (IsNot_Number(req.body.available_qty)) throw new Error(`The Available Quantity fields is need to be a number`);
         req.body.available_qty = parseFloat(req.body.available_qty);
         if (Is_Bigger(req.body.available_qty, 1000)) throw new Error(`The Available Quantity cannot be more than 1000`);
      }

      // Max Orders
      if (req.body.available_qty) {
         if (!req.body.max_order) req.body.max_order = 1;
         if (IsNot_Number(req.body.max_order)) req.body.max_order = 1;
         req.body.max_order = parseFloat(req.body.max_order);
         if (Is_Bigger(req.body.max_order, req.body.available_qty)) req.body.max_order = req.body.available_qty;
      }

      // Quantity Settings
      if (req.body.available_qty) {
         req.body.qty_settings = {available_qty: req.body.available_qty, max_order: req.body.max_order};
      }

      // Shipping Option
      req.body.shipping_option = validateShippingOption(req.body.describe_ship, req.body.price_ship);

      // Selection #1
      req.body.selection_1_name = ValidateText(req.body.selection_1_name, 'Selection Name #1', {minlength: 0, maxlength: 100, isRequired: false});

      if (req.body.selection_1_name) {
         for (let i = 0; i < req.body.se_1_des.length; i++) {
            req.body.se_1_des[i] = ValidateText(req.body.se_1_des[i], 'Selection #1 Descriptions #' + i, {minlength: 0, maxlength: 200, isRequired: false});
         }
      }

      if (req.body.selection_1_name) {
         req.body.se_1_price = Replace_Empty(req.body.se_1_price);
         for (let i = 0; i < req.body.se_1_price.length; i++) {
            if (IsNot_Number(req.body.se_1_price[i])) throw new Error('Invalid Selection #1 Price Data Type');
            req.body.se_1_price[i] = parseFloat(req.body.se_1_price[i]);
            if (Is_Bigger(req.body.se_1_price[i], 1000)) throw new Error('Your Selection #1 Price cannot be bigger than 1000');
         }
      }

      if (req.body.selection_1_name && req.body.se_1_des.filter((element) => element).length >= 1) {
         req.body.selection_1 = {selection_name: req.body.selection_1_name, selection_choices: Make_Selection(req.body.se_1_des, req.body.se_1_price)};
      }

      // Selection #2
      req.body.selection_2_name = ValidateText(req.body.selection_2_name, 'Selection Name #2', {minlength: 0, maxlength: 100, isRequired: false});

      if (req.body.selection_2_name) {
         for (let i = 0; i < req.body.se_2_des.length; i++) {
            req.body.se_2_des[i] = ValidateText(req.body.se_2_des[i], 'Selection #2 Descriptions #' + i, {minlength: 0, maxlength: 200, isRequired: false});
         }
      }

      if (req.body.selection_2_name) {
         req.body.se_2_price = Replace_Empty(req.body.se_2_price);
         for (let i = 0; i < req.body.se_2_price.length; i++) {
            if (IsNot_Number(req.body.se_2_price[i])) throw new Error('Invalid Selection #1 Price Data Type');
            req.body.se_2_price[i] = parseFloat(req.body.se_2_price[i]);
            if (Is_Bigger(req.body.describe_ship[i], 1000)) throw new Error('Your Selection #1 Price cannot be bigger than 1000');
         }
      }

      if (req.body.selection_2_name && req.body.se_1_des.filter((element) => element).length >= 1) {
         req.body.selection_2 = {selection_name: req.body.selection_2_name, selection_choices: Make_Selection(req.body.se_2_des, req.body.se_2_price)};
      }

      // Price
      if (!req.body.price) throw new Error(`The Price fields is Required`);
      req.body.price = parseFloat(req.body.price);
      if (typeof req.body.price !== 'number' && !isNaN(req.body.price)) throw new Error(`The Price fields need to be a number`);
      if (req.product.originalPrice && req.product.originalPrice !== req.body.price) throw new Error('You cant change the Price of your Product while it is still on sale');
      if (req.body.price < 1 || req.body.price > 1000000) throw new Error(`The Price cannot be less than 1 and more than 1000000`);

      if (!req.product.originalPrice && req.body.salesPrice) {
         if (!req.body.salesDuration) throw new Error('You need to put a Duration on your Sales');

         req.body.salesPrice = parseFloat(req.body.salesPrice);
         req.body.salesDuration = parseFloat(req.body.salesDuration);

         if ((typeof req.body.salesPrice !== 'number' && !isNaN(req.body.salesPrice)) || req.body.salesPrice > req.body.price || req.body.salesPrice < 1)
            throw new Error('The Sales Price need to be lower than the Price of ypur Offer');
         if ((typeof req.body.salesDuration !== 'number' && !isNaN(req.body.salesDuration)) || req.body.salesDuration > 30 || req.body.salesDuration < 1)
            throw new Error('The Sales Duration Cannot be longuer than 30 days');
      }

      if (req.product.originalPrice) {
         req.body.stop_sales = req.body.stop_sales ? true : false;
      }

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
exports.Validate_Change_Password = (req, res, next) => {
   try {
      // Old Password
      req.body.password = ValidateText(req.body.password, 'Password', {minlength: 8, maxlength: 200});

      // New Password
      req.body.newPassword = ValidateText(req.body.newPassword, 'New Password', {minlength: 8, maxlength: 200});

      // Confirm Password
      if (typeof req.body.confirmPassword !== 'string') throw new Error(`Invalid Confirm Password Data Type`);
      req.body.confirmPassword = req.body.confirmPassword.trim();
      if (req.body.confirmPassword !== req.body.newPassword) throw new Error(`The new Password doesnt Match`);

      next();
   } catch (e) {
      let url = `/settings?section=security`;
      req.flash('error', e.message);
      res.redirect(url);
   }
};
exports.Validate_AutoDel_Settings = (req, res, next) => {
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
exports.Validate_SearchInput = (req, res, next) => {
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
exports.Validate_Code = (req, res, next) => {
   try {
      const lengths = req.query.type === 'email' ? [9, 9] : [9, 300];
      req.body.code = ValidateText(req.body.code, 'Code', {minlength: lengths[0], maxlength: lengths[1]});
      next();
   } catch (e) {
      req.flash('error', e.message);
      res.redirect(`/2fa?type=${req.query.type}`);
   }
};


exports.validateContactUs = (req, res, next) => {
   try {
      if (!req.body.username) req.body.username = undefined;

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

exports.validateResolveReport = (req, res, next) => {
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

exports.validateReports = (req, res, next) => {
   try {
      if (req.body.username) req.body.username = req.user.username;
      else req.body.username = undefined;

      if (!compareArray(['scam', 'blackmail', 'information', 'other'], req.body.reason)) throw new Error('Invalid Reason');

      req.body.message = ValidateText(req.body.message, 'Message', {minlength: 10, maxlength: 3000});

      req.params.id = ValidateText(req.params.id, 'Id', {minlength: 3, maxlength: 200});

      next();
   } catch (e) {
      console.log(e);
      res.redirect('/404');
   }
};

// function joinArray(array, req) {
//    let joinedString = '';
//    for (let i = 0; i < array.length; i++) {
//       console.log(array[i]);
//       if (typeof array[i] !== 'string') joinedString += `${req[array[i][0]][array[i][1]]}`;
//       else joinedString += array[i];
//    }
//    return joinedString;
// }

// Params Query Validation
// Product


// Custom Validation

exports.Validate_OrderCustomization = async (req, res, next) => {
   try {
      // Params
      if (!req.params.slug) throw new Error(`The Slug Params Empty`);
      if (typeof req.params.slug !== 'string') throw new Error(`The Slug Params isnt a String`);
      if (req.params.slug.length > 200) throw new Error(`The Slug Params is too long`);

      req.product = await Product.findOne({slug: req.params.slug, status: 'online'}).orFail(new Error('Invalid Slug'));

      if (req.user.username === req.product.vendor) throw new Error('You cant Buy Your Own Product');

      if (req.product.available_qty == 0) throw new Error('This Product is Sold Out');
      // Qty
      if (req.body.qty) {
         req.body.qty = isNaN(parseFloat(req.body.qty)) || req.body.qty === 0 ? (req.body.qty = 1) : (req.body.qty = parseFloat(req.body.qty));

         if (req.product.qty_settings) {
            if (req.body.qty > req.product.qty_settings.available_qty) throw new Error(`The maximun Quantity you can take is ${req.product.qty_settings.max_order}`);
            if (req.product.qty_settings.available_qty > req.product.qty_settings.max_order) {
               if (req.body.qty > req.product.qty_settings.max_order) throw new Error(`The maximun Quantity you can take is ${req.product.qty_settings.max_order}`);
            }
         }
      } else req.body.qty = 1;

      // Shipping Option
      if (req.body.shipping_option) req.body.shipping_option = Check_If_Selected_ShippingOptions_Valid(req.body.shipping_option, req.product.shipping_option);

      // Selection #1
      if (req.body.selection_1 && req.product.selection_1) req.body.selection_1 = Get_Selection(req.body.selection_1, req.product.selection_1);

      // Selection #2
      if (req.body.selection_2 && req.product.selection_2) req.body.selection_2 = Get_Selection(req.body.selection_2, req.product.selection_2);
      next();
   } catch (e) {
      console.log(e);
      req.flash('error', e.message);
      res.redirect(`/order/${req.params.slug}`);
   }
};