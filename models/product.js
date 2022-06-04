const mongoose = require('mongoose')
const slugify = require('slugify')
const Order = require('./order')
const Review = require('./review')
const fs = require('fs')
const { unlink } = require('fs')

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

const selection_choiceSchema = new mongoose.Schema({
    choice_name : {
        type : String
    },
    choice_price : {
        type : Number
    }
})

const selectionsSchema = new mongoose.Schema({
    selection_name : {
        type : String,
    },
    selection_choices : [selection_choiceSchema]
}) 

const qty_settingsSchema = new mongoose.Schema({ 
    available_qty : { 
        type : Number
    },
    max_order : { 
        type : Number
    }
})

// const accepted_cryptoSchema = new mongoose.Schema ({
//     xmr : {
//         type : Boolean,
//         default : true,
//     },
//     btc : {
//         type : Boolean,
//     }
// })

const shipping_option = new mongoose.Schema ({
    option_description : {
        type : String,
        required : true
    },
    option_price : {
        type : Number,
        default : 0,
        required : true
    }
})

const productSchema = new mongoose.Schema ({
    vendor : { 
        type : String,
        required : true,
    },
    img_path : { 
        type : String,
        required : true,
    },
    title : {
        type : String,
        required : true,
        minlength : 5,
        maxlength : 500
    },
    description : {
        type : String, 
        required : true,
        minlength : 20, 
        maxlength : 10000      
    },
    message : {
        type : String, 
    },
    price : {
        type : Number,
        required : true,  
        minlength : 1, 
        maxlength : 15 
    },
    currency : { 
        type : String,
        required : true,
        default : 'USD'
    },
    // accepted_crypto : { 
    //     type : accepted_cryptoSchema
    // },
    ship_from : {
        type : String,
        required: true
    },
    allow_hidden : {
        type : Boolean,
    },
    selection_1: {
        type : selectionsSchema
    },
    selection_2: {
        type : selectionsSchema
    },
    details : {
        type : Array
    },
    shipping_option : 
        [shipping_option],

    qty_settings : {
        type : qty_settingsSchema
    },
    review : { 
        type : reviewSchema,
        required: true, 
        default : { number_review : 0, total_note : 0, average_note: 0}
    },
    slug : {
        type : String,
        required: true,
        unique : true
    }
})


// Image Path
function rename_newImg(old_filename, newImg_path) {
    fs.rename(`./public/uploads/product-img/${old_filename}`, `./public/${newImg_path}`, (err) => {
        if (err) throw err
    })
}

function isolate_mimetype(string) {
    const mimetype = string.split('.')
    return `.${mimetype[mimetype.length - 1]}`
}

function deleteOld_Img(path) {
    unlink(path, (err) => {
        if (err) throw err;
    });
}

productSchema.methods.UploadImg = function(filename, Old_Image) {
    console.log(Old_Image)
    if (Old_Image) deleteOld_Img(`./public/${this.img_path}`) // 

    const newImg_path = `/uploads/product-img/${this.slug}${isolate_mimetype(filename)}`

    rename_newImg(filename, newImg_path)

    this.img_path = newImg_path
}



// Change Slug
async function Change_Order_With_Old_Slug(old_slug, new_slug) {
    const orders = await Order.find({product_slug: old_slug})
    for(let i = 0; i < orders.length; i++) {
        orders[i].product_slug = new_slug
        orders[i].save()
    }
}

async function Change_Review_With_Old_Slug(old_slug, new_slug) {
    const reviews = await Review.find({product_slug: old_slug})
    for(let i = 0; i < reviews.length; i++) {
        reviews[i].product_slug = new_slug
        reviews[i].save()
    }
}

// Methods
productSchema.methods.Create_Slug = function(title, vendor) {
    this.slug = slugify(title, { lower: true, strict: true }) + '-' + slugify(vendor, { lower: true, strict: true }) 
}

// Function
function Create_Slug(title, vendor) {
    return slugify(title, { lower: true, strict: true }) + '-' + vendor
}

productSchema.methods.Change_Slug = async function(title, vendor) {
    const old_slug = this.slug
    const new_slug = Create_Slug(title, vendor)

    await Change_Order_With_Old_Slug(old_slug, new_slug)
    await Change_Review_With_Old_Slug(old_slug, new_slug)

    this.slug = new_slug

    //
    const newImg_path = `/uploads/product-img/${this.slug}${isolate_mimetype(this.img_path)}`

    fs.rename(`./public/${this.img_path}`, `./public/${newImg_path}`, (err) => {
        if (err) throw err
    })
//
    this.img_path = newImg_path
}


// Del Product
async function Delete_Orders(slug) {
    const orders = await Order.find({product_slug : slug})
    for(let i = 0; i < orders.length; i++) {
        await orders[i].delete()
    }
}

async function Delete_Reviews(slug) {
    const reviews = await Review.find({product_slug : slug})
    for(let i = 0; i < reviews.length; i++) {
        await reviews[i].delete()
    }
}

productSchema.methods.Delete_Orders_And_Reviews = async function() {
    await Delete_Orders(this.slug)
    await Delete_Reviews(this.slug)
}

module.exports = mongoose.model('Product', productSchema)