const mongoose = require('mongoose')
const fs = require('fs')
const Product = require('./product')
const Order = require('./order')
const Conversation = require('./conversation')
const { deleteOld_Img, isolate_mimetype} = require('../middlewares/function')

const reviewSchema = new mongoose.Schema({
    number_review : {
        type : Number,
        required : true,
    },
    total_note : { 
        type : Number,
        required : true,    
    },
    average_note : { 
        type : Number,
        required : true,
    }
})

const settingsSchema = new mongoose.Schema({
    message_expiring : {
        type: String
    },
    info_expiring : {
        type : String
    },
    user_expiring : {
        type : Number
    },
    currency : { 
        type : String,
        required : true,
        default : 'USD'
    },
    step_verification : {
        type : String, 
    }
})

const userSchema = new mongoose.Schema({
    img_path : {
        type : String
    },
    username: {
        type : String,
        required : true,
        maxlength : 50,
        minlength : 3,
        unique : true
    },
    password : {
        type : String,
        required: true
    },
    authorization : {
        type : String,
        required: true,
        default : 'buyer'
    },
    awaiting_promotion : { 
        type: Boolean
    },
    email : { 
        type : String,
    },
    email_verification_code : { 
        type: String,
    },
    pgp_keys : { 
        type : String,
    },
    pgp_keys_verification_words : { 
        type : String,
    },
    pgp_keys_verification_words_encrypted : { 
        type : String,
    },
    settings : { 
        type : settingsSchema,
        default : { message_expiring : '7', info_expiring : '7'},
        required : true
    },
    job : {
        type : String
    },
    description :  { 
        type : String
    },
    achievement : {
        type : Array
    },
    languages : {
        type : Array 
    },
    pgp : { 
        type : String,
    },
    saved_product : { 
        type : Array
    },
    review : { 
        type : reviewSchema,
        required: true, 
        default : { number_review : 0, total_note : 0, average_note: 0}
    },
    warning : { 
        type: Number,
        default: 0
    },
    expire_at : { 
        type: Number
    }
})


function rename_newImg(old_filename, new_name) {
    fs.rename(`./public/uploads/user-img/${old_filename}`, `./public/${new_name}`, (err) => {
        if (err) throw err
    })
}

userSchema.methods.UploadImg = function(file) {
    if (this.img_path) deleteOld_Img(`./public/${this.img_path}`)    
    const newImg_path = `/uploads/user-img/${this.username}${isolate_mimetype(file.mimetype, '/')}`

    rename_newImg(file.filename, newImg_path)

    this.img_path = newImg_path
}


userSchema.methods.Update_IncativeDate = function() {
    if (this.settings.user_expiring) this.expire_at = Date.now() + this.settings.user_expiring * 86400000
}

userSchema.methods.Add_Remove_Saved_Product = function(id) {
    if (this.saved_product.includes(id)) this.saved_product = this.saved_product.filter(element => element !== id) // Remove
    else this.saved_product.push(id) // Add
}

// DELETE
userSchema.methods.Delete_User_Conversation_Etc = async function() {
    
    // Del Conversations
    const conversations = await Conversation.find({$or : [ {sender_1 : this.username}, {sender_2 : this.username}]})
    for(let i = 0; i < conversations.length; i++) {
        conversations[i].delete()
    }

    // Del Products
    const products = await Product.find({vendor: this.username})
    for(let i = 0; i < products.length; i++) {
        await products[i].Delete_Orders_And_Reviews()
        products[i].delete()
    }

    deleteOld_Img(`./public/${this.img_path}`)   
}

module.exports = mongoose.model('User', userSchema)