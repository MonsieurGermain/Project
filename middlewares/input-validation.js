const { Is_Empty, IsNot_String, Is_Shorter, Is_Longuer, Is_Smaller, Is_Bigger, compareArray, IsNot_Number, deleteOld_Img} = require('./function')


const Banned_Username = ['Admin', 'admin', 'System', 'system']
const Conversation_Type = ['default', 'semi-hidden', 'hidden']
const Rating_Possible = ['1', '2', '3', '4', '5']
const List_Country = ['United-State', 'Canada']
const List_Message_AutoDel = ['1', '3', '7', '30', 'never']
const List_Information_AutoDel = ['0', '1', '3', '7', '30', 'never']
const category = []


function Make_Shipping_Option(descriptions, prices) {
  const shipping_option = []
  for(let i = 0; i < descriptions.length; i++) {
    if (descriptions[i]) shipping_option.push({option_description: descriptions[i], option_price: prices[i] ? prices[i] : 0 })
  }
  return shipping_option
}

function Make_Selection(options, prices) {
  const selection = []
  for(let i = 0; i < options.length; i++) {
    if (options[i]) selection.push({choice_name: options[i], choice_price: prices[i] ? prices[i] : 0})
  }
  return selection
}

function Filter_Empty(value) {
  return value.filter((element) => element)
}

function Replace_Empty(value) {
  for(let i = 0; i < value.length; i++) {
    if (!value[i]) value[i] = '0'
  }
  return value
}


exports.Validate_Login = (req, res, next) => { 
  try {
    // Username
    let name = 'Username'
    if (IsNot_String(req.body.username))                           throw new Error(`Invalid ${name} Data Type`) 
    req.body.username = req.body.username.trim()
    if (Is_Empty(req.body.username))                                               throw new Error(`The ${name} fields is Required`) 
    if (Is_Shorter(req.body.username, 3) || Is_Longuer(req.body.username, 50))    throw new Error(`The ${name} need to be within 3 to 50 characters longs`)
    if (compareArray(Banned_Username, req.body.username))                 throw new Error(`You cannot use this ${name}`) 

    // Password
    name = 'Password'
    if (IsNot_String(req.body.password))                           throw new Error(`Invalid ${name} Data Type`) 
    req.body.password = req.body.password.trim()
    if (Is_Empty(req.body.password))                                               throw new Error(`The ${name} fields is Required`) 
    if (Is_Shorter(req.body.password, 8) || Is_Longuer(req.body.password, 200))   throw new Error(`The ${name} need to be within 8 to 200 characters longs`)
 
    next()
  } catch(e) {
    req.flash('error', e.message)
    res.redirect(req.url)
  }
}

exports.Validate_Register = (req, res, next) => { 
  try {
    // Username
    let name = 'Username'
    if (IsNot_String(req.body.username))                                  throw new Error(`Invalid ${name} Data Type`) 
    req.body.username = req.body.username.trim()
    if (Is_Empty(req.body.username))                                               throw new Error(`The ${name} fields is Required`) 
    if (Is_Shorter(req.body.username, 3) || Is_Longuer(req.body.username, 50))    throw new Error(`The ${name} need to be within 3 to 50 characters longs`) 
    if (compareArray(Banned_Username, req.body.username))                 throw new Error(`You cannot use this ${name}`) 

    // Password
    name = 'Password'
    if (IsNot_String(req.body.password))                                  throw new Error(`Invalid ${name} Data Type`) 
    req.body.password = req.body.password.trim()
    if (Is_Empty(req.body.password))                                               throw new Error(`The ${name} fields is Required`) 
    if (Is_Shorter(req.body.password, 8) || Is_Longuer(req.body.password, 200))   throw new Error(`The ${name} need to be within 8 to 200 characters longs`) 
 
    // Confirm Password
    req.body.confirmPassword = req.body.confirmPassword.trim()
    if (req.body.confirmPassword !== req.body.password)                   throw new Error(`The ${name}s doesnt Match`) 

    next()
  } catch(e) {
    req.flash('error', e.message)
    res.redirect(req.url)
  }
}

exports.Validate_Conversation = (req, res, next) => {
  try {
    // Message
    if (IsNot_String(req.body.message))                                   throw new Error() 
    req.body.message = req.body.message.trim()
    if (Is_Empty(req.body.message))                                                throw new Error() 
    if (Is_Shorter(req.body.message, 2) || Is_Longuer(req.body.message, 1000))    throw new Error() 

    // Conversation Type
    if (!compareArray(Conversation_Type, req.body.type)) throw new Error() 

    if (!Is_Empty(req.body.timestamps)) req.body.timestamps = true

    next()
  } catch (e) {
    res.redirect(`/error`)
  }
}

exports.Validate_Message = (req, res, next) => {
  try {
    // Message
    if (IsNot_String(req.body.message))                                   throw new Error() 
    req.body.message = req.body.message.trim()
    if (Is_Empty(req.body.message))                                                throw new Error() 
    if (Is_Shorter(req.body.message, 2) || Is_Longuer(req.body.message, 1000))    throw new Error() 

    next()
  } catch (e) {
    res.redirect(`/error`)
  }
}

exports.Validate_ProvidedInfo = (req, res, next) => {
  try {
    // Info
    if (IsNot_String(req.body.content))                                   throw new Error('Invalid Information Data Type')
    req.body.info = req.body.content.trim()
    if (Is_Empty(req.body.content))                                                throw new Error('The Information fields is Required') 
    if (Is_Shorter(req.body.content, 2) || Is_Longuer(req.body.info, 3000))    throw new Error('Your Information need to be within 2 to 3000 characters longs')

    next()
  } catch (e) {
    res.redirect(`/error`)
  }
}

exports.Validate_Reviews = (req, res, next) => {
  try {
    // Review
    if (IsNot_String(req.body.review))                                   throw new Error()
    req.body.review = req.body.review.trim()
    if (Is_Empty(req.body.review))                                                throw new Error() 
    if (Is_Shorter(req.body.review, 5) || Is_Longuer(req.body.review, 500))    throw new Error()

    //Note
    if (!compareArray(Rating_Possible, req.body.note)) throw new Error()
    req.body.note = parseFloat(req.body.note)

    //Type
    if (!compareArray(Conversation_Type, req.body.type)) throw new Error()

    next()
  } catch (e) {
    res.redirect(`/error`)
  }
}

exports.Validate_Update_Order = (req, res, next) => {
  try {
    if (!compareArray(['shipped', 'recieved', 'finished', 'rejected', 'not_recieved', 'dispute'], req.body.status)) throw new Error('Update Value Invalid')

    next()
  } catch (e) {
    req.flash('error', e.message)
    res.redirect(`/order-resume/${req.params.id}`)
  }
}

exports.Validate_Profile = (req, res, next) => {
  try {
    // Job
    if (IsNot_String(req.body.job))                                   throw new Error('Invalid Job Data Type')
    req.body.job = req.body.job.trim()
    if (Is_Longuer(req.body.job, 100))    throw new Error('Your Job cannot be longuer than 100 characters longs')

    //Description
    if (IsNot_String(req.body.description))                                   throw new Error('Invalid Description Data Type')
    req.body.description = req.body.description.trim()
    if (Is_Longuer(req.body.description, 3000))    throw new Error('Your Description cannot be longuer than 3000 characters longs')


    req.body.achievement = Filter_Empty(req.body.achievement)
    for(let i = 0; i < req.body.achievement.length; i++) {
      if (IsNot_String(req.body.achievement[i])) throw new Error('Invalid Achievement Data Type')
      if (Is_Longuer(req.body.achievement[i], 50)) throw new Error('Your Achievement cannot be longuer than 50 characters longs')
    }

    req.body.languages = Filter_Empty(req.body.languages)
    for(let i = 0; i < req.body.languages.length; i++) {
      if (IsNot_String(req.body.languages[i])) throw new Error('Invalid Languages Data Type')
      if (Is_Longuer(req.body.languages[i], 50)) throw new Error('Your Languages cannot be longuer than 50 characters longs')
    }

    next()
  } catch (e) {
    const splited_url = req.url.split('?') 
    let url = `${splited_url[0]}`

    if (req.file) {
      deleteOld_Img(req.file.path)
    }
    req.flash('error', e.message)
    res.redirect(url)
  }
}

exports.Validate_Product = (req, res, next) => {
  try {
    // Title
    if (IsNot_String(req.body.title))                           throw new Error(`Invalid Title Data Type`) 
    req.body.title = req.body.title.trim()
    if (Is_Empty(req.body.title))                                               throw new Error(`The Title fields is Required`) 
    if (Is_Shorter(req.body.title, 5) || Is_Longuer(req.body.title, 150))    throw new Error('The Title need to be within 5 to 150 characters longs')

    // Description
    if (IsNot_String(req.body.description))                           throw new Error(`Invalid Description Data Type`) 
    req.body.description = req.body.description.trim()
    if (Is_Empty(req.body.description))                                               throw new Error(`The Description fields is Required`) 
    if (Is_Shorter(req.body.description, 10) || Is_Longuer(req.body.description, 20000))    throw new Error('The Description need to be within 10 to 20000 characters longs')

    // Price
    if (Is_Empty(req.body.price)) throw new Error(`The Price fields is Required`)
    if (IsNot_Number(req.body.price))  throw new Error(`The Price fields need to be a number`)
    req.body.price = parseFloat(req.body.price)
    if (Is_Smaller(req.body.price, 1) || Is_Bigger(req.body.price, 1000000)) throw new Error(`The Price cannot be less than 1 and more than 1000000`)

    // Message
    if (IsNot_String(req.body.message))                                   throw new Error('Invalid Message Data Type')
    req.body.message = req.body.message.trim()
    if (Is_Longuer(req.body.message, 500))    throw new Error('Your Message cannot be longuer than 100 characters longs')

    //Allow Hidden
    if (req.body.allow_hidden) req.body.allow_hidden = true 

    // Ship From
    if (!compareArray(List_Country, req.body.ship_from)) throw new Error('Selected Country Invalid')

    // Details
    req.body.details = Filter_Empty(req.body.details)
    for(let i = 0; i < req.body.details.length; i++) {
      if (IsNot_String(req.body.details[i])) throw new Error('Invalid Details Data Type')
      if (Is_Longuer(req.body.details[i], 100)) throw new Error('Your Details cannot be longuer than 100 characters longs')
    }

    // Availble Quantity
    if (!Is_Empty(req.body.available_qty)) {
      if (IsNot_Number(req.body.available_qty))  throw new Error(`The Available Quantity fields is need to be a number`)
      req.body.available_qty = parseFloat(req.body.available_qty)
      if (Is_Bigger(req.body.available_qty, 1000)) throw new Error(`The Available Quantity cannot be more than 1000`)
    }

    // Max Orders
    if (!Is_Empty(req.body.available_qty)) {
      if (Is_Empty(req.body.max_order))  req.body.max_order = 1
      if (IsNot_Number(req.body.max_order))  req.body.max_order = 1
      req.body.max_order = parseFloat(req.body.max_order)
      if (Is_Bigger(req.body.max_order, req.body.available_qty)) req.body.max_order = req.body.available_qty
    }

    // Quantity Settings
    if (!Is_Empty(req.body.available_qty)) {
      req.body.qty_settings = { available_qty : req.body.available_qty, max_order: req.body.max_order}
    }

    // Shipping Option
    for(let i = 0; i < req.body.describe_ship.length; i++) {
      if (IsNot_String(req.body.describe_ship[i])) throw new Error('Invalid Shipping Option Description Data Type')
      if (Is_Longuer(req.body.describe_ship[i], 200)) throw new Error('Your Shipping Option Description cannot be longuer than 200 characters longs')
    }

    req.body.price_ship = Replace_Empty(req.body.price_ship)
    for(let i = 0; i < req.body.price_ship.length; i++) {
      if (IsNot_Number(req.body.price_ship[i])) throw new Error('Invalid Shipping Option Price Data Type')
      req.body.price_ship[i] = parseFloat(req.body.price_ship[i])
      if (Is_Bigger(req.body.price_ship[i], 1000)) throw new Error('Your Shipping Option Price cannot be bigger than 1000')
    }

    req.body.shipping_option = Make_Shipping_Option(req.body.describe_ship, req.body.price_ship)


    // Selection #1
    if (IsNot_String(req.body.selection_1_name))                                   throw new Error('Invalid Selection #1 Name Data Type')
    req.body.selection_1_name = req.body.selection_1_name.trim()
    if (Is_Longuer(req.body.selection_1_name, 100))    throw new Error('Your Selection #1 Name cannot be longuer than 100 characters longs')


    if (!Is_Empty(req.body.selection_1_name)) {
      for(let i = 0; i < req.body.se_1_des.length; i++) {
        if (IsNot_String(req.body.se_1_des[i])) throw new Error('Invalid Selection #1 Descriptions Description Data Type')
        if (Is_Longuer(req.body.se_1_des[i], 200)) throw new Error('Your Selection #1 Descriptions cannot be longuer than 200 characters longs')
      }
    }


    if (!Is_Empty(req.body.selection_1_name)) {
    req.body.se_1_price = Replace_Empty(req.body.se_1_price)
    for(let i = 0; i < req.body.se_1_price.length; i++) {
      if (IsNot_Number(req.body.se_1_price[i])) throw new Error('Invalid Selection #1 Price Data Type')
      req.body.se_1_price[i] = parseFloat(req.body.se_1_price[i])
      if (Is_Bigger(req.body.se_1_price[i], 1000)) throw new Error('Your Selection #1 Price cannot be bigger than 1000')
    }
   }

   if (!Is_Empty(req.body.selection_1_name) && req.body.se_1_des.filter((element) => element).length >= 1) {
      req.body.selection_1 = {selection_name: req.body.selection_1_name, 
      selection_choices: Make_Selection(req.body.se_1_des, req.body.se_1_price)} 
   }

  // Selection #2
  if (IsNot_String(req.body.selection_2_name))                                   throw new Error('Invalid Selection #1 Name Data Type')
   req.body.selection_2_name = req.body.selection_2_name.trim()
  if (Is_Longuer(req.body.selection_2_name, 100))    throw new Error('Your Selection #1 Name cannot be longuer than 100 characters longs')

  if (!Is_Empty(req.body.selection_2_name)) {
    for(let i = 0; i < req.body.se_2_des.length; i++) {
      if (IsNot_String(req.body.se_2_des[i])) throw new Error('Invalid Selection #1 Descriptions Description Data Type')
      if (Is_Longuer(req.body.se_2_des[i], 200)) throw new Error('Your Selection #1 Descriptions cannot be longuer than 200 characters longs')
    }
  }

  if (!Is_Empty(req.body.selection_2_name)) {
  req.body.se_2_price = Replace_Empty(req.body.se_2_price)
  for(let i = 0; i < req.body.se_2_price.length; i++) {
    if (IsNot_Number(req.body.se_2_price[i])) throw new Error('Invalid Selection #1 Price Data Type')
    req.body.se_2_price[i] = parseFloat(req.body.se_2_price[i])
    if (Is_Bigger(req.body.describe_ship[i], 1000)) throw new Error('Your Selection #1 Price cannot be bigger than 1000')
  }
  }

  if (!Is_Empty(req.body.selection_2_name) && req.body.se_1_des.filter((element) => element).length >= 1) {
  req.body.selection_2 = {selection_name: req.body.selection_2_name, selection_choices: Make_Selection(req.body.se_2_des, req.body.se_2_price)} 
  }

  next()
  } catch (e) {
    let url = `${req.url}`

    if (req.file) {
      deleteOld_Img(req.file.path)
    }
    req.flash('error', e.message)
    res.redirect(url)
  }
}

exports.Validate_Change_Password = (req, res, next) => {
  try {
    // Old Password
    if (IsNot_String(req.body.password))                                  throw new Error(`Invalid Password Data Type`) 
    req.body.password = req.body.password.trim()
    if (Is_Empty(req.body.password))                                               throw new Error(`The Password fields is Required`) 
    if (Is_Shorter(req.body.password, 8) || Is_Longuer(req.body.password, 200))   throw new Error(`The Password need to be within 8 to 200 characters longs`) 

    // New Password
    if (IsNot_String(req.body.newPassword))                                  throw new Error(`Invalid New Password Data Type`) 
    req.body.newPassword = req.body.newPassword.trim()
    if (Is_Empty(req.body.newPassword))                                               throw new Error(`The New Password fields is Required`) 
    if (Is_Shorter(req.body.newPassword, 8) || Is_Longuer(req.body.newPassword, 200))   throw new Error(`The New Password need to be within 8 to 200 characters longs`) 

    // Confirm Password
    req.body.confirmPassword = req.body.confirmPassword.trim()
    if (req.body.confirmPassword !== req.body.newPassword)                   throw new Error(`The Password doesnt match`) 
    
    next()
  } catch (e) {
    let url = `/settings/${req.user.username}?section=security`
    req.flash('error', e.message)
    res.redirect(url)
  }
}

exports.Validate_AutoDel_Settings = (req, res, next) => {
  try {

    if (!compareArray(List_Message_AutoDel, req.body.messages)) throw new Error('The Selected Auto Delete Message Settings is Invalid')
    if (!compareArray(List_Information_AutoDel, req.body.informations)) throw new Error('The Selected Auto Delete Information Settings is Invalid')

    if (req.body.messages === 'never') req.body.messages = undefined
    if (req.body.informations === 'never') req.body.informations = undefined

    next()
  } catch (e) {
    let url = `/settings/${req.user.username}?section=privacy`
    req.flash('error', e.message)
    res.redirect(url)
  }
}

// Put Error Message Front End
exports.Validate_SearchInput = (req, res, next) => {
  try {
    // Search
    if (IsNot_String(req.body.search))                                   throw new Error('Invalid Search Data Type')
    req.body.search = req.body.info.trim()
    if (Is_Longuer(req.body.search, 500))    throw new Error('Your cannot search with more than 500 charachters')

    //Category
    if (compareArray(category, req.body.category)) throw new Error('Selected Category Invalid')

    next()
  } catch (e) {
    req.flash('error', e.message)
    res.redirect(`/products`)
  }
}
