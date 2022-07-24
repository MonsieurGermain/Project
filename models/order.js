const mongoose = require('mongoose')
const User = require('../models/user')

const shipping_optionSchema = new mongoose.Schema({
    option_name : {
        type : String
    },
    option_price : {
        type : Number
    }
}) 

const selection_choiceSchema = new mongoose.Schema({
    choice_name : {
        type : String
    },
    choice_price : {
        type : Number
    }
})

const selectionSchema = new mongoose.Schema({
    selection_name : {
        type : String,
    },
    selected_choice : selection_choiceSchema
})

const submited_infoSchema = new mongoose.Schema({
    sender : { 
        type : String
    },
    content : {
        type : String
    }
})

const orderSchema = new mongoose.Schema ({
    buyer: {
        type : String,
        required: true
    },
    vendor: { 
        type : String,
        required: true
    },
    product_slug : {
        type : String,
        minlength : 12,
        maxlength : 507,
        required : true
    },
    product_title : { 
        type : String,
        required : true
    },
    status : {
        type : String,
        required : true
    },
    timer : { 
        type : Number,
    },
    reset_left : { 
        type : Number, 
    },
    let_review : { 
        type : Boolean,
    },
    qty : {
        type : Number,
        required : true,
        default : 1
    },
    base_price : {
        type : Number,
        required : true
    },
    total_price : {
        type : Number,
        required : true
    },
    messages : [submited_infoSchema],

    address : {
        type: String,
        required : true,
        default : 'Basic XMR/BTC address'
    },
    shipping_option : {
        type : shipping_optionSchema
    },
    selection_1 : { 
        type : selectionSchema
    },
    selection_2 : { 
        type : selectionSchema
    },
    privacy : { 
        type : String,
        required : true
    },
    admin : { 
        type : String,
    },
    dispute_winner : { 
        type : String,
    }
})

orderSchema.methods.Reset_Timer = function() {
    this.timer = Date.now() + 604800000
    this.reset_left += -1

    if (this.reset_left === 0) this.reset_left = undefined

    return this
}

async function returnUser_infoSettings(username) {
    const user = await User.findOne({username: username})
    return user.settings.info_expiring
}

orderSchema.methods.Apply_buyerDeleteInfo = async function(settings) {
    // if (!settings) {
    //     await returnUser_infoSettings(this.buyer)
    // }

    // Delete Provided Info
    if (settings.info_expiring === 0) { this.timer = undefined;  this.submited_info = []; } // Instantly Del
    else if (settings.info_expiring && settings.info_expiring !== 0) this.timer = Date.now() + settings.info_expiring * 86400000  //Set timer until Auto Del
    else if (!settings.info_expiring) this.timer = undefined  //Never Delete Auto Del

    return this
}

orderSchema.methods.Reject_Order = function() {
    this.status = 'rejected'
    this.timer = undefined
    this.submited_info = []
    return this
}

orderSchema.methods.Expire_Order = function() {
    this.status = 'expired'
    this.timer = undefined
    this.submited_info = []
    return this
}

orderSchema.methods.Expired_Timer = async function() {
    switch(this.status) {
        case 'awaiting_info' :
            this.Expire_Order()
        break
        case 'awaiting_payment' :
            this.Expire_Order()
        break
        case 'awaiting_shipment' :
            this.Expire_Order()
        break
        case 'shipped' :
            order.status = 'recieved'
            order.timer =  Date.now() + 2 * 24 * 60 * 60 * 1000
        break
        case 'recieved' :
            this.status = 'finalized'
            await this.Apply_buyerDeleteInfo(false)
        break
        case 'finalized' :
            this.submited_info = [] // ??
            this.timer = undefined
        break
        case 'disputed' :
            this.status = 'disputed'
            await this.Apply_buyerDeleteInfo(false)
        break
    }
}

module.exports = mongoose.model('Order', orderSchema)