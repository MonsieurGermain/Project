const mongoose = require('mongoose');
const User = require('./user');
const slugify = require('slugify');
const {format} = require('date-fns');
const {formatUsernameWithSettings} = require('../middlewares/function');

const settingsSchema = new mongoose.Schema({
   type: {
      type: String,
      required: true,
      default: 'default',
   },
   timestamps: {
      type: Boolean,
      default: false,
   },
});

const messageSchema = new mongoose.Schema({
   sender: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 50,
   },
   message: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 10000,
   },
   messageView: {
      type: Boolean,
   },
   timestamps: {
      type: Date,
      required: false,
   },
   expire_at: {},
});

const conversationSchema = new mongoose.Schema({
   sender_1: {
      type: String,
      maxlength: 50,
      minlength: 3,
      ref: 'User',
      required: true,
   },
   sender_2: {
      type: String,
      maxlength: 50,
      minlength: 3,
      ref: 'User',
      required: true,
   },
   sender1_Img: {
      type: String,
      required: true,
   },
   sender2_Img: {
      type: String,
      required: true,
   },
   sender1_Pgp: {
      type: String,
   },
   sender2_Pgp: {
      type: String,
   },
   includePgp : { 
      type: Boolean,
   },
   messages: [messageSchema],

   settings: {
      type: settingsSchema,
   },
});

function Create_New_Message(Message, Sender, sender_1, conversationSettings, userSettings) {
   const newMessage = {
      sender: sender_1 === Sender ? formatUsernameWithSettings(Sender, conversationSettings.type) : Sender,
      message: Message.trim(),
   };

   if (conversationSettings.timestamps) newMessage.timestamps = format(new Date(), 'HH:mm LLLL dd yyyy'); // Add timestamp

   if (userSettings.recordSeeingMessage && conversationSettings.type === 'default') newMessage.messageView = false; // Saw Message

   if (userSettings.messageExpiring) newMessage.expire_at = Date.now() + userSettings.messageExpiring * 86400000;

   return newMessage;
}

// Add
conversationSchema.methods.Add_New_Message = function (Message, From_User, userSettings) {
   this.messages.push(Create_New_Message(Message, From_User, this.sender_1, this.settings, userSettings));
   return this;
};


function canCRUDMessage(messageSender, conversationSender_1, conversationSender_2, userUsername) {
   if (conversationSender_1 === userUsername) {
      if (messageSender !== conversationSender_1) return true
   } else if (conversationSender_2 === userUsername) {
      if (messageSender === conversationSender_2) return true
   }
   return;
}

conversationSchema.methods.editMessage = async function (messageId, newMessage, userUsername) {
   for (let i = 0; i < this.messages.length; i++) {
      if (this.messages[i].id === messageId) {

         if (canCRUDMessage(this.messages[i].sender, this.sender_1, this.sender_2, userUsername)) this.messages[i].message = newMessage;
         break;
      }
   }
};

// Delete
conversationSchema.methods.deleteConversation = async function () {
   await this.delete();
};

conversationSchema.methods.deleteMessageWithDate = async function (date) {
   this.messages = this.messages.filter((message) => message.expire_at > date);
};

conversationSchema.methods.deleteMessageWithId = async function (messageId, userUsername) {
   const indexOfMessage = this.messages.map((message) => message.id).indexOf(messageId)
   
   if (canCRUDMessage(this.messages[indexOfMessage].sender, this.sender_1, this.sender_2, userUsername)) this.messages.splice(indexOfMessage, 1)
};

conversationSchema.methods.sawMessages = async function (userUsername) {
   for (let i = 0; i < this.messages.length; i++) {
      if (this.messages[i].messageView === false && this.messages[i].sender !== userUsername) {
         this.messages[i].messageView = true
      }
   }
   await this.save();
};

conversationSchema.methods.updateNewPgp = async function (username, newPgp) {
   if (username === this.sender_1)
    if (this.includePgp === false) {
      this.sender1_Pgp = newPgp;
    } 
   else this.sender2_Pgp = newPgp;

   this.save();
};

conversationSchema.methods.updateNewImgPath = async function (username, newImgPath) {
   if (username === this.sender_1) this.sender1_Img = newImgPath;
   else this.sender2_Img = newImgPath;

   this.save();
};

// Search
conversationSchema.static('isConversationExisting', async function (username_1, username_2, conversation_type) {
   let query;
   if (conversation_type === 'default')
      query = {
         $or: [
            {sender_1: username_1, sender_2: username_2},
            {sender_1: username_2, sender_2: username_1},
         ],
         'settings.type': conversation_type,
      };
   else
      query = {
         sender_1: username_1,
         sender_2: username_2,
         'settings.type': conversation_type,
      };

   return await this.findOne(query);
});

conversationSchema.static('findAllUserConversations', async function (username) {
   return await this.find({$or: [{sender_1: username}, {sender_2: username}]});
});


conversationSchema.statics.findByIdVerifyIfPartOfConversation = async function(conversationId, username) {
   const conversation = await this.findById(conversationId)

   if (username === conversation.sender_1 || username === conversation.sender_2) return conversation
   else throw new Error()
}


module.exports = mongoose.model('Conversation', conversationSchema);
