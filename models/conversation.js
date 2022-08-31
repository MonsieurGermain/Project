const mongoose = require('mongoose');
const User = require('./user');
const slugify = require('slugify');
const {format} = require('date-fns');
const {Format_Username_Settings} = require('../middlewares/function');

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
   messages: [messageSchema],

   settings: {
      type: settingsSchema,
   },
});

function Create_New_Message(Message, Sender, sender_1, conversationSettings, userSettings) {
   const New_Message = {
      sender: sender_1 === Sender ? Format_Username_Settings(Sender, conversationSettings.type) : Sender,
      message: Message.trim(),
   };

   if (conversationSettings.timestamps) New_Message.timestamps = format(new Date(), 'HH:mm LLLL dd yyyy'); // Add timestamp

   if (conversationSettings.type === 'default' && userSettings.recordSeeingMessage) New_Message.messageView = false; // Saw Message

   if (userSettings.message_expiring === 'seeing') New_Message.expire_at = 'seeing';
   else if (userSettings.message_expiring) New_Message.expire_at = Date.now() + userSettings.message_expiring * 86400000;

   return New_Message;
}

// Add
conversationSchema.methods.Add_New_Message = function (Message, From_User, userSettings) {
   this.messages.push(Create_New_Message(Message, From_User, this.sender_1, this.settings, userSettings));
   return this;
};

conversationSchema.methods.editMessage = async function (messageId, newMessage) {
   for (let i = 0; i < this.messages.length; i++) {
      if (this.messages[i].id === messageId) {
         this.messages[i].message = newMessage;
         break;
      }
   }
   await this.save();
};

// Delete
conversationSchema.methods.deleteConversation = async function () {
   await this.delete();
};

conversationSchema.methods.deleteMessageWithDate = async function (date) {
   this.messages = this.messages.filter((message) => message.expire_at > date);
};

conversationSchema.methods.deleteMessageWithId = async function (messageId) {
   this.messages = this.messages.filter((message) => message.id !== messageId);
};

conversationSchema.methods.sawMessages = async function (userUsername) {
   for (let i = 0; i < this.messages.length; i++) {
      if (this.messages[i].sender !== userUsername) {
         if (this.messages[i].messageView === false) this.messages[i].messageView = true;
      }
   }
   await this.save();
};

conversationSchema.methods.updateNewPgp = async function (username, newPgp) {
   if (username === this.sender_1) this.sender1_Pgp = newPgp;
   else this.sender2_Pgp = newPgp;

   this.save();
};

conversationSchema.methods.updateNewImgPath = async function (username, newImgPath) {
   if (username === this.sender_1) this.sender1_Img = newImgPath;
   else this.sender2_Img = newImgPath;

   this.save();
};

// Search
conversationSchema.static('findIf_conversationExist', function (username_1, username_2, conversation_type) {
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

   return this.findOne(query);
});

conversationSchema.static('Find_allConversation_ofUser', function (username) {
   return this.find({$or: [{sender_1: username}, {sender_2: username}]});
});

module.exports = mongoose.model('Conversation', conversationSchema);
