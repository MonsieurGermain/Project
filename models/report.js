const mongoose = require('mongoose')
const Product = require('../models/product') 
const User = require('../models/user')


const reportSchema = new mongoose.Schema({ 
    reference_id : { 
        type : String,
        required : true
    },
    reason : { 
        type : String,
        required : true
    },
    type : {
        type : String,
        required : true
    },
    explaination : { 
        type : String,
        required : true
    },
    archived : { 
        type : Boolean,
        default : false,
        required : true
    }
})

module.exports = mongoose.model('Report', reportSchema)