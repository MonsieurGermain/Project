const express = require('express')
const router = express.Router()

const Product = require('../models/product')
const Order = require('../models/order')
const User = require('../models/user')
const { Need_Authentification } = require('../middlewares/authentication')
const { Validate_ProvidedInfo, Validate_Update_Order, Validate_Params_Slug_Product, Validate_Params_Id_Order, Validate_Params_Id_Order_Buyer, Validate_Params_Username_Order,  Validate_Order_Customization  } = require('../middlewares/validation')
const { Format_Username_Settings } = require('../middlewares/function')

function Calculate_Price(base_price , qty, ship_opt_price, selection_1_price, selection_2_price) {
    let price = base_price + selection_1_price + selection_2_price // Base Price OF Each
    price = price * qty // Mult Qty
    price = price + ship_opt_price // Add Shipping Price
    price += (price * 0.03) // Market Fee
    price = price.toString() // Get 2 number after . 
    price = price.slice(0, price.indexOf('.') + 3)
  
    return parseFloat(price) 
}


function sortOrder_PerStatus(orders) {
    const sorted_order = {
        all : orders, 
        awaiting_info : [],
        awaiting_payment : [],
        awaiting_shipment : [],
        shipped : [],
        recieved : [],
        finalized : [],
        rejected : [],
        expired : [],
    }

    for(let i = 0; i < orders.length; i++) {
        switch(orders[i].status) {
            case 'awaiting_info' :
                sorted_order.awaiting_info.push(orders[i])
            break
            case 'awaiting_payment':
                sorted_order.awaiting_payment.push(orders[i])
            break
            case 'awaiting_shipment' :
                sorted_order.awaiting_shipment.push(orders[i])
            break
            case 'shipped' :
                sorted_order.shipped.push(orders[i])
            break
            case 'recieved' :
                sorted_order.recieved.push(orders[i])
            break
            case 'finalized' :
                sorted_order.finalized.push(orders[i])
            break
            case 'rejected' :
                sorted_order.rejected.push(orders[i])
            break
            case 'expired' :
                sorted_order.expired.push(orders[i])
            break
        }
    }
    return sorted_order
}

async function HandleOrderRequest(request, order, user_settings) {
    switch(request) {
        case 'shipped':
            order.status = request  
            order.reset_left = 3
            order.timer =  Date.now() + 604800000 // 1weeks
        break
        case 'recieved':
            order.status = request
            order.timer =  Date.now() + 172800000 // 2days
        break
        case 'finished' : 
            await order.Finalize_Order(user_settings)
        break
        case 'rejected':
            order.Reject_Order(user_settings)
        break
        case 'not_recieved':
            order.Reset_Timer()
        break
        case 'dispute' :
            order.status = 'dispute_progress'
            order.timer = undefined
        break
    }
    return order
}

// Better Name ?
function Get_Int_In_Number(number, Timer, Time_Left, Time_Amount) {
    let value = Timer / number 
    value = value.toString()
    value = value.slice(0, value.indexOf('.') + 0)
    Timer += - (value * number)
    Time_Left = Time_Left + ` ${value}${Time_Amount}`

    return [Timer , Time_Left]
}

function Format_Timer(timer) {
    let Time_Left = '';
    let Timer = timer - Date.now();
    
    [Timer, Time_Left] = Get_Int_In_Number(86400000, Timer, Time_Left, 'Days');
    [Timer, Time_Left] = Get_Int_In_Number(3600000, Timer, Time_Left, 'Hours');
    [Timer, Time_Left] = Get_Int_In_Number(60000, Timer, Time_Left, 'Mins');
    [Timer, Time_Left] = Get_Int_In_Number(1000, Timer, Time_Left, 'Secs');

    return Time_Left
}

async function Get_Product_Img(slug) {
    const product = await Product.findOne({slug : slug})
    return product.img_path
}

function Create_Order_Link(status, id, buyer) {
    if (buyer) {
        switch(status) {
            case 'awaiting_info' :
            return `/submit-info/${id}`
            case 'awaiting_payment' :
            return `/pay/${id}`
        }
    } 
    return `/order-resume/${id}`
}

function Include_Delete_Link(status, buyer){
    switch(status) {
        case 'rejected' :
            return true
        case 'finalized' :
            return true
        case 'expired' :
            return true
    }

    // Allow Winner of dispute to delete

    if (buyer && status === 'awaiting_info') {
        return true
    }
    return
}
async function Format_Order(order, buyer, order_link) {
    order.product_img = await Get_Product_Img(order.product_slug)

    order.Formated_Timers = Format_Timer(order.timer)
    order.buyer = Format_Username_Settings(order.buyer, order.privacy)
    order.deletelink = Include_Delete_Link(order.status, buyer)

    if (order_link) order.link = Create_Order_Link(order.status, order.id, buyer)
    
    return order
}
async function Format_Orders_Array(orders, buyer = false, order_link = true) {
    for(let i = 0; i < orders.length; i++) {
        orders[i] = await Format_Order(orders[i], buyer, order_link)
    }
    return orders
}

// Routes
router.get('/order/:slug', 
Need_Authentification, Validate_Params_Slug_Product,
async (req,res) => {
    try { 
        const { product } = req
        // const product = await Product.findOne({slug : req.params.slug}).orFail(new Error('Invalid Slug'))
        const vendor = await User.findOne({username : product.vendor})

        res.render('order', { product , vendor})

    } catch (e) {
        console.log(e)
        res.redirect('/error')
        return
    }
})


router.post('/create-order/:slug',
Need_Authentification, Validate_Params_Slug_Product, Validate_Order_Customization,
async (req,res) => {
    try {
        const { product } = req
        let {qty, shipping_option, selection_1, selection_2, type} = req.body

        qty = qty > 1 ? qty : 1
        if (product.qty_settings) {
            product.qty_settings.available_qty += - qty
        }


        const order = new Order({
            buyer : req.user.username,
            vendor : product.vendor,
            product_title : product.title,
            product_slug : product.slug,
            base_price : product.price,
            total_price : product.price,
            qty : qty,
            shipping_option : shipping_option,
            selection_1 : selection_1,
            selection_2 : selection_2,
            status : 'awaiting_info',
            timer : Date.now() + (30 * 60 * 1000), // 30min
            privacy : type
        })

        order.total_price = Calculate_Price(
            order.base_price, 
            order.qty, 
            order.shipping_option ? order.shipping_option.option_price : 0, 
            order.selection_1 ? order.selection_1.selected_choice.choice_price : 0, 
            order.selection_2 ? order.selection_2.selected_choice.choice_price : 0)

        await product.save()
        await order.save()

        res.redirect(`/submit-info/${order.id}`)
        
    } catch (e) {
        console.log(e)
        res.redirect('/error')
        return
    }
})


router.get('/submit-info/:id', Validate_Params_Id_Order_Buyer,
Need_Authentification, 
async (req,res) => {
    try {
        const { order } = req
        const product = await Product.findOne({slug : order.product_slug})
        const user = await User.findOne({username: order.vendor})
        res.render('submit-info', { order, product_message : product.message, pgp : user.pgp})
    } catch(e) {
        console.log(e)
        res.redirect('/error')
        return
    }
})


router.post('/submit-info/:id', 
Need_Authentification, Validate_Params_Id_Order, Validate_ProvidedInfo,
async (req,res) => {
    try {
        const { order } = req

        order.messages.push({ 
            sender : req.user.username === order.buyer ? Format_Username_Settings(req.user.username, order.privacy) : req.user.username,
            content : req.body.content
        })        

        let redirect_url = `/order-resume/${order.id}`

        if (order.status === 'awaiting_info') {
            order.status = 'awaiting_payment'
            order.timer = Date.now() + (1000 * 60 * 60)
            redirect_url = `/pay/${order.id}`
        }

        await order.save()

        res.redirect(redirect_url)

    } catch(e) {
        console.log(e)
        res.redirect('/error')
        return
    }
})


router.get('/pay/:id', 
Need_Authentification, Validate_Params_Id_Order_Buyer,
async (req,res) => {
    try {
        const { order } = req
        res.render('pay', { order })
    } catch(e){
        console.log(e)
        res.redirect('/error')
        return
    }
})



router.get('/order-resume/:id',
Need_Authentification, Validate_Params_Id_Order,
async (req, res) => {
    try {
        let { order } = req
        const product = await Product.findOne({slug : order.product_slug})

        order = await Format_Order(order, order.buyer === req.user.username ? true : false)

        res.render('order-resume', { order, product })
    } catch(e){
        console.log(e)
        res.redirect('/error')
        return
    }
})



router.put('/update-order/:id', Need_Authentification, Validate_Params_Id_Order, Validate_Update_Order,
async (req,res) => {
    let { order } = req

    order = await HandleOrderRequest(req.body.status, order, req.user.settings)

    await order.save()

    res.redirect(`/order-resume/${req.params.id}`)
})



router.get('/orders/:username',
Need_Authentification, Validate_Params_Username_Order,
async (req,res) => {

    let { your_order, clients_order } = req

    your_order = await Format_Orders_Array(your_order, true)
    clients_order = await Format_Orders_Array(clients_order)
    
    your_order = sortOrder_PerStatus(your_order)
    clients_order = sortOrder_PerStatus(clients_order)

    res.render('your-order', {your_order, clients_order} )
})



router.delete('/delete-order/:id', Need_Authentification, Validate_Params_Id_Order,
async (req,res) => {
    const { order } = req

    order.delete()

    res.redirect(`/orders/${req.user.username}`)
})

module.exports = router