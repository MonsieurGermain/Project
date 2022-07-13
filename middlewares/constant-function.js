const Conversation = require('../models/conversation')
const Order = require('../models/order')
const User = require('../models/user')

async function Delete_Expired_Message() {
    const date = Date.now()
    const Delete_Old_Message = await Conversation.find({'messages.expire_at' : { $lt : date }})

    for(let i = 0; i < Delete_Old_Message.length; i++) {
      Delete_Old_Message[i].messages = Delete_Old_Message[i].messages.filter(message => message.expire_at > date)

      if (!Delete_Old_Message[i].messages.length) {
        await Delete_Old_Message[i].delete()
        return
      }

      await Delete_Old_Message[i].save()
    }
} 
exports.Auto_Delete_Expired_Message = setInterval(async function(){ await Delete_Expired_Message()}, 300000) // 5 min 



async function Check_Recieved_Payment (){
  const orders = await Order.find({status : 'awaiting_payment'})
  for(let i = 0; i < orders.length; i++) {
    orders[i].status = 'awaiting_shipment'
    orders[i].timer = Date.now() + 3 * 24 * 60 * 60 * 1000 // 3days
    orders[i].save()
  }
}
exports.Auto_Check_Recieved_Payment = setInterval(async function(){ await Check_Recieved_Payment()}, 60000) //1 min



// Refund if paid
async function Update_Order() {
  const orders = await Order.find({timer : {$lt : Date.now()}})
  for(let i = 0; i < orders.length; i++) {
    await orders[i].Expired_Timer()

    orders[i].save()
  }
}
exports.Update_Order_ExpiredTimer = setInterval(async function(){ await Update_Order()}, 450000) //7.5 min



async function Delete_InactiveUser() {
  const users = await User.find({expire_at : { $lt : Date.now()}})
  for(let i = 0; i < users.length; i++) {
    await users[i].Delete_User_Conversation_Etc()
    await users[i].delete() 
  }
}
exports.autoDelete_InactiveUser = setInterval(async function(){ await Delete_InactiveUser()}, 86400000) // 1day 