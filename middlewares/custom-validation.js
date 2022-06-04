const User = require('../models/user')

function Check_If_Selected_ShippingOptions_Valid(selected_opt, available_opt) {
    let taken_opt 
    for(let i = 0; i < available_opt.length; i++) {
        if(selected_opt === available_opt[i].option_description) {
            taken_opt = { option_name : available_opt[i].option_description, option_price : available_opt[i].option_price }
        break
        }
    }
    return taken_opt
}
function Get_Selection(selected_select, available_select) {
    let taken_select

    for(let i = 0; i < available_select.selection_choices.length ; i++) {
        if(available_select.selection_choices[i].choice_name === selected_select) {
            taken_select = { 
                selection_name : available_select.selection_name,
                selected_choice : {
                    choice_name : available_select.selection_choices[i].choice_name,
                    choice_price : available_select.selection_choices[i].choice_price
                }
            }
            break
        }
    }
    return taken_select
}
function compareArray(array, value) {
    for(let i = 0; i < array.length; i++) {
      if(array[i] === value) return true
    }
    return
}
function IsNot_String(value) {
    if (typeof(value) !== 'string') return true
    return
}
function IsNot_Number(value) {
    if(isNaN(parseFloat(value))) return true
    return 
}
  
exports.Validate_Send_Message_To_Himself = async (req, res, next) => {
    try { 
        if (req.user.username === req.params.username) throw new Error('You cant send a Message to Yourself')

        next()
    } catch(e) {
      console.log(e)
      req.flash('error', e.message)
      res.redirect(`/profile/${req.user.username}`)
    }
}

exports.Validate_Order_Customization = async (req, res, next) => {
    try { 
        if (req.user.username === req.product.vendor) throw new Error('You cant Buy Your Own Product')

        // Qty
        if (req.body.qty) {
            if (!IsNot_Number(req.body.qty))
            req.body.qty = parseFloat(req.body.qty)
            
            if (req.product.qty_settings) {
                if (req.body.qty > req.product.qty_settings.available_qty)  throw new Error(`The maximun Quantity you can take is ${req.product.qty_settings.max_order}`)
                if (req.product.qty_settings.available_qty > req.product.qty_settings.max_order) {
                    if (req.body.qty > req.product.qty_settings.max_order) throw new Error(`The maximun Quantity you can take is ${req.product.qty_settings.max_order}`)
                }
            } 
        } else req.body.qty = 1

        // Shipping Option
        if (req.body.shipping_option) req.body.shipping_option = Check_If_Selected_ShippingOptions_Valid(req.body.shipping_option, req.product.shipping_option)

        // Selection #1
        if (req.body.selection_1 && req.product.selection_1) req.body.selection_1 = Get_Selection(req.body.selection_1, req.product.selection_1)

        // Selection #2
        if (req.body.selection_2 && req.product.selection_2) req.body.selection_2 = Get_Selection(req.body.selection_2, req.product.selection_2)
        next()
    } catch(e) {
      console.log(e)
      req.flash('error', e.message)
      res.redirect(`/order/${req.params.slug}`)
    }
}

exports.Validate_Query_Section_Settings = async (req, res, next) => {
  try { 
    if (req.query.section) {
      if (!compareArray(['security', 'privacy', 'saved'], req.query.section)) throw new Error('Invalid Settings Section')
    }
    next()
  } catch(e) {
    console.log(e)
    req.flash('error', e.message)
    res.redirect(`/settings/${req.params.slug}`)
  }
} 

exports.Validate_Query_Url = async (req, res, next) => {
  try { 
    if (!req.query.url) req.query.url = '/'
    if (IsNot_String(req.query.url)) throw new Error('Invalid Query Url')
    next()
  } catch(e) {
    req.redirect('/error')
  }
}

exports.Check_If_Username_Taken = async (req, res, next) => {
  try { 
    const Is_Taken = await User.findOne({username : req.body.username})
    
    if (Is_Taken) throw new Error('This Username is Already Taken')
    
    next()
  } catch(e) {
    req.flash('error', e.message)
    res.redirect('/register')
  }
}