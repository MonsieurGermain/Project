const Product = require('../models/product')
const Conversation = require('../models/conversation')
const Order = require('../models/order')
const User = require('../models/user')
const { Is_Empty, IsNot_String} = require('./function')
 
  
// Product
exports.Validate_Query_Slug_Product_Required = async (req,res, next) => {
    try { 
        if (IsNot_String(req.query.slug)) throw new Error('Query Slug not String')
        if (Is_Empty(req.query.slug)) throw new Error('Query Slug Empty')

        req.product = await Product.findOne({slug: req.query.slug}).orFail(new Error('Invalid Query Slug'))
    
        next()
    } catch(e) {
      console.log(e)
      res.redirect('/404')
    }
}

exports.Validate_Query_Product_Slug = async (req,res, next) => {
    try { 
        if (!Is_Empty(req.query.slug)) {
            if (IsNot_String(req.query.slug)) throw new Error('Query Slug not String')
        }

        if (req.query.slug) req.product = await Product.findOne({slug: req.query.slug, vendor: req.user.username}).orFail(req.product = new Product())
        else req.product = new Product()
    
        next()
    } catch(e) {
      console.log(e)
      res.redirect('/404')
    }
}

exports.Validate_Params_Slug_Product_Vendor = async (req, res, next) => {
    try { 
        if (Is_Empty(req.params.slug)) throw new Error('Params Slug Empty')
        if (IsNot_String(req.params.slug)) throw new Error('Params Slug not String')

        req.product = await Product.findOne({slug: req.params.slug, vendor: req.user.username}).orFail(new Error('Params Slug Invalid'))

        next()
    } catch(e) {
      console.log(e)
      res.redirect('/404')
    }
}

exports.Validate_Params_Slug_Product = async (req, res, next) => {
    try { 
        if (Is_Empty(req.params.slug)) throw new Error('Params Slug Empty')
        if (IsNot_String(req.params.slug)) throw new Error('Params Slug not String')

        req.product = await Product.findOne({slug: req.params.slug}).orFail(new Error('Params Slug Invalid'))

        next()
    } catch(e) {
      console.log(e)
      res.redirect('/404')
    }
}

// Conversation
exports.Validate_Params_Username_Conversation = async (req, res, next) => {
    try { 
        if (Is_Empty(req.params.username)) throw new Error('Params Username Empty')
        if (IsNot_String(req.params.username)) throw new Error('Params Username not String')

        req.Found_Conversation = await Conversation.Find_If_Conversation_Exist(req.user.username, req.params.username, req.body.type)

        next()
    } catch(e) {
      console.log(e)
      res.redirect('/404')
    }
}

exports.Validate_Params_Id_Conversation = async (req, res, next) => {
    try { 
        if (Is_Empty(req.params.id)) throw new Error('Params Id Empty')
        if (IsNot_String(req.params.id)) throw new Error('Params Id not String')

        req.conversation = await Conversation.findById(req.params.id).orFail(new Error('Params Id Invalid'))
        if (req.user.username !== req.conversation.sender_1 && req.user.username !== req.conversation.sender_2) throw new Error('Params Id Invalid')

        next()
    } catch(e) {
      console.log(e)
      res.redirect('/404')
    }
}

exports.Validate_Params_Username_Conversations = async (req, res, next) => {
    try { 
        req.conversations = await Conversation.Find_All_Conversation_User(req.user.username)

        next()
    } catch(e) {
      console.log(e)
      res.redirect('/404')
    }
}

exports.Validate_Params_Message_Id_Conversation = async (req, res, next) => {
    try { 
        if (Is_Empty(req.params.message_id)) throw new Error('Params Message Id Empty')
        if (IsNot_String(req.params.message_id)) throw new Error('Params Message Id not String')
        next()
    } catch(e) {
      console.log(e)
      res.redirect('/404')
    }
}

exports.Validate_Query_Id_Conversations = async (req, res, next) => {
    try { 
        if (!Is_Empty(req.query.id)) {
            if (IsNot_String(req.query.id)) throw new Error('Query Id not String')
        }

        next()
    } catch(e) {
      console.log(e)
      res.redirect('/404')
    }
}


// Orders
exports.Validate_Params_Id_Order = async (req, res, next) => {
    try { 
        if (Is_Empty(req.params.id)) throw new Error('Params Id Empty')
        if (IsNot_String(req.params.id)) throw new Error('Params Id not String')

        req.order = await Order.findById(req.params.id).orFail('Invalid Params Id')
        if (req.user.username !== req.order.buyer && req.user.username !== req.order.vendor) throw new Error('Cant Access')

        next()
    } catch(e) {
        console.log(e)
        res.redirect('/404')
    }
}

exports.Validate_Params_Id_Order_Buyer = async (req, res, next) => {
  try { 
      if (Is_Empty(req.params.id)) throw new Error('Params Id Empty')
      if (IsNot_String(req.params.id)) throw new Error('Params Id not String')

      req.order = await Order.findById(req.params.id).orFail('Invalid Params Id')
      if (req.user.username !== req.order.buyer) throw new Error('Cant Access')

      next()
  } catch(e) {
      console.log(e)
      res.redirect('/404')
  }
}

exports.Validate_Params_Username_Order = async (req, res, next) => {
    try { 
        if (Is_Empty(req.params.username)) throw new Error('Params Username Empty')
        if (IsNot_String(req.params.username)) throw new Error('Params Username not String')
        if (req.params.username !== req.user.username) throw new Error()

        req.your_order = await Order.find({buyer : req.params.username})
        req.clients_order = await Order.find({vendor : req.params.username})

        next()
    } catch(e) {
        console.log(e)
        res.redirect('/404')
    }
}


// User 
exports.Validate_Params_Username_User = async (req, res, next) => {
  try { 
      if (IsNot_String(req.params.username)) throw new Error('Params Username not String')
      if (Is_Empty(req.params.username)) throw new Error('Params Username Empty')

      req.vendor = await User.findOne({username: req.params.username}).orFail(new Error('Username Params Invalid'))

      next()
  } catch(e) {
      console.log(e)
      res.redirect('/404')
  }
}

exports.Validate_Params_Username_User_ReqUser = async (req, res, next) => {
  try { 
      if (IsNot_String(req.params.username)) throw new Error('Params Username not String')
      if (Is_Empty(req.params.username)) throw new Error('Params Username Empty')

      if (req.params.username !== req.user.username) throw new Error('Cant Access')

      next()
  } catch(e) {
      console.log(e)
      res.redirect('/404')
  }
}