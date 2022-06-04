const mongoose = require('mongoose')
const User = require('./user')


const reviewSchema = new mongoose.Schema ({
    product_slug : { 
        type : String,
        required : true
    },
    sender : {
        type : String,
        required : true
    },
    content : {
        type : String,
        required : true
    },
    type : { 
        type : String,
        required : true
    },
    note : {
        type : Number,
        required : true
    }
})


reviewSchema.methods.Get_Reviewer_Profile_Pic = async function() {
    switch(this.type) {
        case 'default' :
        const user = await User.findOne({username : this.sender})
        this.img_path = user.img_path  
        break
        default :
        this.img_path = '/default/default.png'
    }
    return this
}


module.exports = mongoose.model('Review', reviewSchema)