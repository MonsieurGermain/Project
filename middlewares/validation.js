const { isMoneroAddress, isEmail, isPgpKeys } = require('./function');

// Vars
const bannedUsername = ['admin', 'admins', 'system', 'systems', 'hidden', 'anonymous'];
const conversationType = ['default', 'semi-hidden', 'hidden'];
const possibleRating = ['1', '2', '3', '4', '5'];
const countryList = ['United-State', 'Canada'];
// const category = [];

function filterEmpty(value) {
  return value.filter((element) => element);
}

function validateNumber(value, inputName, { min = 1, max = 1e6, isRequired = true } = {}) {
  value = parseFloat(value);

  if (!isRequired && !value) return undefined;

  if (typeof value !== 'number' || isNaN(value)) throw new Error(`Invalid ${inputName} Data Type`);

  if (isRequired && !value) throw new Error(`The ${inputName} fields is Required`);
  if (value > max || value < min) throw new Error(`The ${inputName} can have a value ranging from ${min} to ${max}`);

  return value;
}

function ValidateText(value, inputName, { minlength = 3, maxlength = 50, isRequired = true } = {}) {
  if (!isRequired && !value) return undefined;

  if (typeof value !== 'string') throw new Error(`Invalid ${inputName} Data Type`);

  value = value.trim();

  if (isRequired && !value) throw new Error(`The ${inputName} fields is Required`);
  if (value.length > maxlength || value.length < minlength) {
    throw new Error(`The ${inputName} need to be within ${minlength} to ${maxlength} characters longs`);
  }
  return value;
}

// Function
function validateShippingOption(shippingOptionDecription, shippingOptionPrice) {
  const returnShippingOptions = [];

  for (let i = 0; i < shippingOptionDecription.length; i++) {
    if (shippingOptionDecription[i]) {
      shippingOptionDecription[i] = ValidateText(
        shippingOptionDecription[i],
        `Shipping Option Description #${i + 1}`,
        { minlength: 0, maxlength: 200, isRequired: false },
      );

      shippingOptionPrice[i] = validateNumber(
        shippingOptionPrice[i],
        `Shipping Option Price #${i + 1}`,
        { min: 1, max: 1000, isRequired: false },
      );
      if (!shippingOptionPrice[i]) shippingOptionPrice[i] = 0;

      returnShippingOptions[i] = {
        option_description: shippingOptionDecription[i],
        option_price: shippingOptionPrice[i],
      };
    }
  }
  return returnShippingOptions;
}

function makeSelectionChoice(selectionOption, selectionPrice, selectionNum) {
  const selectionChoices = [];

  for (let i = 0; i < selectionOption.length; i++) {
    if (selectionOption[i]) {
      selectionOption[i] = ValidateText(
        selectionOption[i],
        `Selection ${selectionNum} Option Description #${i + 1}`,
        { minlength: 0, maxlength: 200, isRequired: false },
      );

      selectionPrice[i] = validateNumber(
        selectionPrice[i],
        `Selection ${selectionNum} Option Price #${i + 1}`,
        { min: -1000, max: 1000, isRequired: false },
      );
      if (!selectionPrice[i]) selectionPrice[i] = 0;

      selectionChoices[i] = { choice_name: selectionOption[i], choice_price: selectionPrice[i] };
    }
  }
  return selectionChoices;
}

function createSelection(selectionName, selectionOption, selectionPrice, selectionNum) {
  selectionName = ValidateText(
    selectionName,
    `Selection Name #${selectionNum}`,
    { minlength: 0, maxlength: 200, isRequired: false },
  );

  if (!selectionName) return undefined;

  const selectionChoice = makeSelectionChoice(selectionOption, selectionPrice, selectionNum);

  if (!selectionChoice.length) return undefined;

  return { selection_name: selectionName, selection_choices: selectionChoice };
}

// Input Validation
function sanitizeLoginInput(req, res, next) {
  try {
    // Username
    req.body.username = ValidateText(req.body.username, 'Username', { minlength: 1, maxlength: 25 });

    // Password
    req.body.password = ValidateText(req.body.password, 'Password', { minlength: 8, maxlength: 200 });

    next();
  } catch (e) {
    req.flash('error', e.message);
    res.redirect(req.url);
  }
}
function sanitizeRegisterInput(req, res, next) {
  try {
    // Username
    req.body.username = ValidateText(req.body.username, 'Username', { minlength: 1, maxlength: 25 });
    if (bannedUsername.includes(req.body.username.toLowerCase())) throw new Error('You cannot use this Username');

    // Password
    req.body.password = ValidateText(req.body.password, 'Password', { minlength: 8, maxlength: 200 });

    // Confirm Password
    req.body.confirmPassword = ValidateText(
      req.body.confirmPassword,
      'Confirm Password',
      { minlength: 8, maxlength: 200 },
    );
    if (req.body.confirmPassword !== req.body.password) throw new Error('The Passwords doesnt Match');

    next();
  } catch (e) {
    req.flash('error', e.message);
    res.redirect(req.url);
  }
}
function sanitizeConversationInput(req, res, next) {
  try {
    // Message
    req.body.message = ValidateText(req.body.message, 'Message', { minlength: 2, maxlength: 1000 });

    // Conversation Type
    if (!conversationType.includes(req.body.type)) throw new Error('Invalid Conversation Type');

    req.body.timestamps = req.body.timestamps ? true : undefined;

    if (![undefined, 'noPgp', 'ownPgp', 'otherPgp'].includes(req.body.pgpSettings)) {
      throw new Error('Invalid Pgp Settings');
    }

    if (req.body.otherPgpKeys) {
      req.body.otherPgpKeys = isPgpKeys(req.body.otherPgpKeys);
      if (!req.body.otherPgpKeys) throw new Error('The other Pgp Keys you provided is Invalid');
    }

    next();
  } catch (e) {
    req.flash('error', e.message);
    res.redirect(`/profile/${req.params.username}?productPage=1&reviewPage=1`);
  }
}
function sanitizeMessageInput(req, res, next) {
  try {
    req.body.message = ValidateText(req.body.message, 'Message', { minlength: 2, maxlength: 1000 });
    next();
  } catch (e) {
    res.redirect('/404');
  }
}

function sanitizeReviewInput(req, res, next) {
  try {
    req.body.review = ValidateText(req.body.review, 'Review', { minlength: 5, maxlength: 5000 });

    if (!possibleRating.includes(req.body.note)) throw new Error();

    if (!conversationType.includes(req.body.type)) throw new Error();

    next();
  } catch (e) {
    res.redirect('/404');
  }
}

function sanitizeProfileInput(req, res, next) {
  try {
    req.body.job = ValidateText(req.body.job, 'Job', { minlength: 0, maxlength: 100, isRequired: false });

    req.body.description = ValidateText(
      req.body.description,
      'Description',
      { minlength: 0, maxlength: 3000, isRequired: false },
    );

    if (req.body.achievement) {
      req.body.achievement = filterEmpty(req.body.achievement);
      for (let i = 0; i < req.body.achievement.length; i++) {
        req.body.achievement[i] = ValidateText(
          req.body.achievement[i],
          `Achievement #${i}${1}`,
          { minlength: 0, maxlength: 50, isRequired: false },
        );
      }
    } else req.body.achievement = undefined;

    if (req.body.languages) {
      req.body.languages = filterEmpty(req.body.languages);
      for (let i = 0; i < req.body.languages.length; i++) {
        req.body.languages[i] = ValidateText(
          req.body.languages[i],
          `Languages #${i}${1}`,
          { minlength: 0, maxlength: 50, isRequired: false },
        );
      }
    } else req.body.languages = undefined;

    next();
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/edit-profile?productPage=1&reviewPage=1');
  }
}

function sanitizeProductInput(req, res, next) {
  try {
    // Title
    req.body.title = ValidateText(req.body.title, 'Title', { minlength: 5, maxlength: 250 });

    // Description
    req.body.description = ValidateText(req.body.description, 'Description', { minlength: 10, maxlength: 20000 });

    // Message
    req.body.message = ValidateText(req.body.message, 'Message', { minlength: 0, maxlength: 1000, isRequired: false });

    // Allow Hidden
    req.body.allowHidden = req.body.allowHidden ? true : undefined;

    // Ship From
    if (!countryList.includes(req.body.shipFrom)) throw new Error('Selected Country Invalid');

    // Details
    if (req.body.aboutProduct) {
      req.body.aboutProduct = filterEmpty(req.body.aboutProduct);
      for (let i = 0; i < req.body.aboutProduct.length; i++) {
        req.body.aboutProduct[i] = ValidateText(
          req.body.aboutProduct[i],
          `About Product #${i}${1}`,
          { minlength: 0, maxlength: 175, isRequired: false },
        );
      }
    } else req.body.aboutProduct = undefined;

    const productDetails = [];
    for (let i = 0; i < req.body.productDetails.length; i++) {
      req.body.productDetails[i] = ValidateText(
        req.body.productDetails[i],
        `Product Details #${i}${1}`,
        { minlength: 0, maxlength: 250, isRequired: false },
      );
      req.body.productDetailsDescription[i] = ValidateText(
        req.body.productDetailsDescription[i],
        `Product Details Description #${i}`,
        { minlength: 0, maxlength: 500, isRequired: false },
      );

      if (req.body.productDetails[i] && req.body.productDetailsDescription[i]) {
        productDetails.push({
          details: req.body.productDetails[i],
          detailsDescription: req.body.productDetailsDescription[i],
        });
      } else req.body.productDetails.splice(i, 1);
    }

    req.body.productDetails = productDetails;

    // Custom Monero Address
    req.body.customMoneroAddress = req.body.customMoneroAddress
      ? isMoneroAddress(req.body.customMoneroAddress, 'Custom') : undefined;

    // Availble Quantity
    req.body.qtySettings = validateNumber(
      req.body.qtySettings,
      'Available',
      { min: 1, max: 1000, isRequired: false },
    );

    req.body.max_order = validateNumber(
      req.body.max_order,
      'Maximun per Order',
      { min: 1, max: req.body.qtySettings ? req.body.qtySettings : 1000, isRequired: false },
    );

    // Quantity Settings
    req.body.qtySettings = { available_qty: req.body.qtySettings, max_order: req.body.max_order };

    // Shipping Option
    req.body.shippingOptions = validateShippingOption(req.body.describe_ship, req.body.price_ship);

    // Selection #1
    req.body.selection1 = createSelection(req.body.selection_1_name, req.body.se_1_des, req.body.se_1_price, 1);

    // Selection #2
    req.body.selection2 = createSelection(req.body.selection_2_name, req.body.se_2_des, req.body.se_2_price, 2);

    // Price
    req.body.price = validateNumber(req.body.price, 'Price');

    if (req.product.salesPrice && req.product.price !== req.body.price) {
      throw new Error('You cant change the Price of your Product while it is still on sale');
    }

    req.body.salesPrice = validateNumber(
      req.body.salesPrice,
      'Sales Price',
      { min: 1, max: req.body.price - 1, isRequired: false },
    );

    req.body.salesDuration = req.body.salesDuration
      ? validateNumber(req.body.salesDuration, 'Sales Duration', { min: 1, max: 30, isRequired: false }) : 1;

    if (req.product.salesPrice) {
      if (req.product.salesPrice !== req.body.salesPrice) {
        throw new Error('You cant change the Price of your Sales while on Sales');
      }
      if (req.product.salesDuration !== req.body.salesDuration) {
        throw new Error('You cant change the Duration of your Sales while on Sales');
      }
      req.body.stopSales = !!req.body.stopSales;
    }

    if (req.body.deleteAdditionnalImg) {
      if (typeof (req.body.deleteAdditionnalImg) === 'string') {
        if (req.body.deleteAdditionnalImg !== '1' && req.body.deleteAdditionnalImg !== '2') {
          throw new Error('Invalid Image to Delete');
        }
        req.body.deleteAdditionnalImg = [req.body.deleteAdditionnalImg];
      } else {
        if (req.body.deleteAdditionnalImg[0] !== '1' && req.body.deleteAdditionnalImg[0] !== '2') {
          throw new Error('Invalid Image to Delete');
        }
        if (req.body.deleteAdditionnalImg[1] !== '1' && req.body.deleteAdditionnalImg[1] !== '2') {
          throw new Error('Invalid Image to Delete');
        }
      }
    } else req.body.deleteAdditionnalImg = undefined;

    // Status
    if (!['online', 'offline'].includes(req.body.status)) throw new Error('Invalid Status Value');

    next();
  } catch (e) {
    console.log(e);
    const url = `${req.url}`;

    req.flash('error', e.message);
    res.redirect(url);
  }
}

function sanitizeChangePassword(req, res, next) {
  try {
    // Old Password
    req.body.password = ValidateText(req.body.password, 'Password', { minlength: 8, maxlength: 200 });

    // New Password
    req.body.newPassword = ValidateText(req.body.newPassword, 'New Password', { minlength: 8, maxlength: 200 });

    // Confirm Password
    req.body.confirmPassword = ValidateText(
      req.body.confirmPassword,
      'Confirm New Password',
      { minlength: 8, maxlength: 200 },
    );
    if (req.body.confirmPassword !== req.body.newPassword) throw new Error('The new Password doesnt Match');

    next();
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/settings?section=security');
  }
}

function sanitizeVerificationCode(req, res, next) {
  try {
    const lengths = req.query.type === 'email' ? [9, 9] : [9, 300];

    req.body.code = ValidateText(req.body.code, 'Code', { minlength: lengths[0], maxlength: lengths[1] });

    next();
  } catch (e) {
    req.flash('error', e.message);
    res.redirect(`/2fa?type=${req.query.type}`);
  }
}

function validateContactUs(req, res, next) {
  try {
    req.body.username = req.body.username ? req.user.username : undefined;

    if (!['feedback', 'bug', 'help', 'other'].includes(req.body.reason)) throw new Error('Invalid Reason');

    req.body.message = ValidateText(req.body.message, 'Message', { minlength: 10, maxlength: 3000 });

    if (req.body.email) {
      if (!isEmail(req.body.email)) throw new Error('The Email field must be a valid Email');
    } else req.body.email = undefined;

    next();
  } catch (e) {
    req.flash('error', e.message);
    res.redirect('/contactus');
  }
}

function validateResolveReport(req, res, next) {
  try {
    req.body.message = ValidateText(req.body.message, 'Message to the vendor', { minlength: 10, maxlength: 3000 });

    if (req.body.banReason) {
      req.body.banReason = ValidateText(req.body.banReason, 'Reason of Banning', { minlength: 10, maxlength: 3000 });
    } else {
      req.body.banReason = undefined;
    }

    next();
  } catch (e) {
    console.log(e);
    req.flash('error', e.message);
    res.redirect('/reports');
  }
}

function validateReports(req, res, next) {
  try {
    req.body.username = req.body.username ? req.user.username : undefined;

    if (!['scam', 'blackmail', 'information', 'other'].includes(req.body.reason)) throw new Error('Invalid Reason');

    req.body.message = ValidateText(req.body.message, 'Message', { minlength: 10, maxlength: 3000 });

    req.params.id = ValidateText(req.params.id, 'Id', { minlength: 3, maxlength: 200 });

    next();
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
}

// Make Order Validation
function isShippingOptionValid(shippingOption, availableShippingOption) {
  for (let i = 0; i < availableShippingOption.length; i++) {
    if (shippingOption === availableShippingOption[i].option_description) {
      return {
        optionName: availableShippingOption[i].option_description,
        optionPrice: availableShippingOption[i].option_price,
      };
    }
  }

  throw new Error('Invalid Selected Shipping Option');
}

function isSelectionValid(selectedSelection, availableSelection) {
  for (let i = 0; i < availableSelection.selection_choices.length; i++) {
    if (selectedSelection === availableSelection.selection_choices[i].choice_name) {
      return {
        selectionName: availableSelection.selection_name,
        selectedChoice: {
          choiceName: availableSelection.selection_choices[i].choice_name,
          choicePrice: availableSelection.selection_choices[i].choice_price,
        },
      };
    }
  }
  throw new Error('Invalid Selected Selection');
}

function maxQuantity(maxPerOrder, availableQuantity) {
  if (maxPerOrder) {
    if (maxPerOrder < availableQuantity) return availableQuantity;
    return maxPerOrder;
  }
  if (availableQuantity) return availableQuantity;
  return 1000;
}

async function sanitizeOrderCustomization(req, res, next) {
  try {
    if (req.user.username === req.product.vendor) throw new Error('You cant Buy Your Own Product');
    if (req.product.available_qty == 0) throw new Error('This Product is Sold Out');

    if (!['default', 'semi-hidden', 'hidden'].includes(req.body.privacyType)) throw new Error('Invalid Privacy Settings');

    if (!req.body.quantity) req.body.quantity = 1;
    else {
      req.body.quantity = validateNumber(
        req.body.quantity,
        'Quantity',
        { max: maxQuantity(req.product.qty_settings.max_order, req.product.qty_settings.available_qty) },
      );
    }

    // Shipping Option
    if (req.body.shippingOption) {
      req.body.chosenShippingOption = isShippingOptionValid(
        req.body.shippingOption,
        req.product.shipping_option,
      );
    }

    // Selection #1
    if (req.body.selection1 && req.product.selection_1) {
      req.body.chosenSelection1 = isSelectionValid(
        req.body.selection1,
        req.product.selection_1,
      );
    }

    // Selection #2
    if (req.body.selection2 && req.product.selection_2) {
      req.body.chosenSelection2 = isSelectionValid(
        req.body.selection2,
        req.product.selection_2,
      );
    }

    next();
  } catch (e) {
    console.log(e);
    req.flash('error', e.message);
    res.redirect(`/order/${req.params.slug}`);
  }
}

function isObject(value) {
  if (value instanceof Object) {
    if (value instanceof Array) return undefined;
    return true;
  }
  return undefined;
}

function sanitizeInput(value) {
  if (!value) throw new Error();
  if (typeof (value) !== 'string') throw new Error();
  if (value.length > 250) throw new Error();
}

function sanitizeObject(object) {
  if (!isObject(object)) throw new Error();

  const querysValues = Object.keys(object);

  for (let i = 0; i < querysValues.length; i++) {
    sanitizeInput(object[querysValues[i]]);
  }
}

function sanitizeQuerys(req, res, next) {
  try {
    if (req.query)sanitizeObject(req.query);

    next();
  } catch (e) {
    console.log('Invalid Query');
    res.redirect('/404');
  }
}

function sanitizeParams(req, res, next) {
  try {
    if (req.params)sanitizeObject(req.params);

    next();
  } catch (e) {
    console.log('Invalid Params');
    res.redirect('/404');
  }
}

function sanitizeParamsQuerys(req, res, next) {
  try {
    sanitizeObject(req.query);
    sanitizeObject(req.params);

    next();
  } catch (e) {
    console.log('Invalid Query or Params');
    res.redirect('/404');
  }
}

module.exports = {
  isObject,
  sanitizeQuerys,
  sanitizeParams,
  sanitizeParamsQuerys,
  sanitizeOrderCustomization,
  validateReports,
  validateResolveReport,
  validateContactUs,
  sanitizeVerificationCode,
  sanitizeChangePassword,
  sanitizeProductInput,
  sanitizeProfileInput,
  sanitizeReviewInput,
  sanitizeMessageInput,
  sanitizeConversationInput,
  sanitizeRegisterInput,
  sanitizeLoginInput,
};
