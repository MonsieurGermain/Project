const mongoose = require('mongoose');
const { format } = require('date-fns');
const { formatUsernameWithSettings } = require('../middlewares/function');

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
  includePgp: {
    type: Boolean,
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

function createNewMessage(Message, Sender, sender1, conversationSettings, userSettings) {
  const newMessage = {
    sender: sender1 === Sender ? formatUsernameWithSettings(Sender, conversationSettings.type) : Sender,
    message: Message.trim(),
  };

  if (conversationSettings.timestamps) {
    newMessage.timestamps = format(new Date(), 'HH:mm LLLL dd yyyy'); // Add timestamp
  }

  if (userSettings.recordSeeingMessage && conversationSettings.type === 'default') {
    newMessage.messageView = false; // Saw Message
  }

  if (userSettings.messageExpiring) newMessage.expire_at = Date.now() + userSettings.messageExpiring * 86400000;

  return newMessage;
}

// Add
conversationSchema.methods.Add_New_Message = function (Message, fromUser, userSettings) {
  this.messages.push(createNewMessage(Message, fromUser, this.sender_1, this.settings, userSettings));
  return this;
};

function canCRUDMessage(messageSender, conversationSender1, conversationSender2, userUsername) {
  if (conversationSender1 === userUsername) {
    if (messageSender !== conversationSender1) return true;
  } else if (conversationSender2 === userUsername) {
    if (messageSender === conversationSender2) return true;
  }
}

conversationSchema.methods.editMessage = async function (messageId, newMessage, userUsername) {
  for (let i = 0; i < this.messages.length; i++) {
    if (this.messages[i].id === messageId) {
      if (canCRUDMessage(
        this.messages[i].sender,
        this.sender_1,
        this.sender_2,
        userUsername,
      )) {
        this.messages[i].message = newMessage;
      }
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
  const indexOfMessage = this.messages.map((message) => message.id).indexOf(messageId);

  if (canCRUDMessage(
    this.messages[indexOfMessage].sender,
    this.sender_1,
    this.sender_2,
    userUsername,
  )) {
    this.messages.splice(indexOfMessage, 1);
  }
};

conversationSchema.methods.sawMessages = async function (userUsername) {
  for (let i = 0; i < this.messages.length; i++) {
    if (this.messages[i].messageView === false && this.messages[i].sender !== userUsername) {
      this.messages[i].messageView = true;
    }
  }
  await this.save();
};

conversationSchema.methods.updateNewPgp = async function (username, newPgp) {
  if (username === this.sender_1) {
    if (this.settings.pgpSettings) {
      this.sender1_Pgp = newPgp;
    }
  } else {
    this.sender2_Pgp = newPgp;
  }

  this.save();
};

// Search
conversationSchema.static('isConversationExisting', async function (username1, username2, conversationType) {
  let query;
  if (conversationType === 'default') {
    query = {
      $or: [
        { sender_1: username1, sender_2: username2 },
        { sender_1: username2, sender_2: username1 },
      ],
      'settings.type': conversationType,
    };
  } else {
    query = {
      sender_1: username1,
      sender_2: username2,
      'settings.type': conversationType,
    };
  }

  const conversation = await this.findOne(query);
  return conversation;
});

conversationSchema.static('findAllUserConversations', async function (username) {
  const conversations = await this.find({ $or: [{ sender_1: username }, { sender_2: username }] });
  return conversations;
});

conversationSchema.statics.findByIdVerifyIfPartOfConversation = async function (conversationId, username) {
  const conversation = await this.findById(conversationId);

  if (username === conversation.sender_1 || username === conversation.sender_2) return conversation;
  throw new Error();
};

module.exports = mongoose.model('Conversation', conversationSchema);
