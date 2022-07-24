const mongoose = require('mongoose')

const contactusSchema = new mongoose.Schema ({
    username : { 
        type : String,
    }, 
    email : { 
        type : String,
    }, 
    message : {
        type : String,
        required : true, 
    }, 
    reason : {
        type : String,
        required : true, 
    }, 
    archived : { 
        type : Boolean
    }
})


module.exports = mongoose.model('Contactus', contactusSchema)