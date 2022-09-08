const Conversation = require('../models/conversation');
const Order = require('../models/order');
const User = require('../models/user');
const Product = require('../models/product');

async function deleteExpiredMessage() {
   const date = Date.now();
   const conversationWithOldMessages = await Conversation.find({'messages.expire_at': {$lt: date}});

   for (let i = 0; i < conversationWithOldMessages.length; i++) {
      conversationWithOldMessages[i].deleteMessageWithDate(date);

      if (!conversationWithOldMessages[i].messages.length) {
         const sender1 = await User.findOne({username: conversationWithOldMessages[i].sender_1});

         if (!sender1 || sender1.settings.deleteEmptyConversation) conversationWithOldMessages[i].deleteConversation();
         else conversationWithOldMessages[i].save();
      } else {
         conversationWithOldMessages[i].save();
      }
   }
   console.log('Delete Expired Message Runned');
}
autoDeleteExpiredMessage = setInterval(() => {
   deleteExpiredMessage();
}, 300000); // 5 min

async function Check_Recieved_Payment() {
   const orders = await Order.find({status: 'awaiting_payment'});
   for (let i = 0; i < orders.length; i++) {
      orders[i].status = 'awaiting_shipment';
      orders[i].timer = Date.now() + 3 * 24 * 60 * 60 * 1000; // 3days
      orders[i].save();
   }
}
Auto_Check_Recieved_Payment = setInterval(() => {
   Check_Recieved_Payment();
}, 60000); //1 min

// Refund if paid
async function Update_Order() {
   const orders = await Order.find({timer: {$lt: Date.now()}});
   for (let i = 0; i < orders.length; i++) {
      await orders[i].Expired_Timer();

      orders[i].save();
   }
}
Update_Order_ExpiredTimer = setInterval(() => {
   Update_Order();
}, 450000); //7.5 min

async function Delete_InactiveUser() {
   const users = await User.find({expire_at: {$lt: Date.now()}});
   for (let i = 0; i < users.length; i++) {
      await users[i].deleteUser();
   }
}
autoDelete_InactiveUser = setInterval(() => {
   Delete_InactiveUser();
}, 86400000); // 1day

async function automaticlyEndSales() {
   const products = await Product.find({sales_end: {$lt: Date.now()}});

   for (let i = 0; i < products.length; i++) {
      products[i].endSales();
      products[i].save();
   }
}
automaticly_EndSales = setInterval(() => {
   automaticlyEndSales();
}, 300000); // 5min 300000


module.exports = {automaticly_EndSales, autoDelete_InactiveUser, Update_Order_ExpiredTimer, Auto_Check_Recieved_Payment, autoDeleteExpiredMessage}