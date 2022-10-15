const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { format } = require('date-fns');

const usersSchema = new mongoose.Schema({
  user: {
    type: mongoose.Types.ObjectId,
    ref: 'User',
  },
  userId: {
    type: String,
    required: true,
  },
  conversationUsername: {
    type: String,
  },
  conversationPgp: {
    type: String,
  },
  messageExpiryDate: {
    type: String,
  },
});

const settingsSchema = new mongoose.Schema({
  includeTimestamps: {
    type: Boolean,
  },
  messageView: {
    type: Boolean,
  },
  deleteEmpty: {
    type: Boolean,
  },
  conversationPassword: {
    type: String,
  },
  daysUntilExpiring: {
    type: Number,
  },
  convoExpiryDate: {
    type: Number,
  },
});

const conversationSchema = new mongoose.Schema({
  users: [usersSchema],
  messages: {
    type: Array,
    required: true,
  },
  settings: {
    type: settingsSchema,
  },
});

function findUserIndex(users, senderId) {
  const userIndex = users.map((singleUser) => singleUser.userId).indexOf(senderId);

  if (userIndex === -1) throw Error('Invalid Sender');

  return userIndex;
}

function canCrudMessage(users, userId) {
  if (users !== userId) throw Error('Forbidden');
}

function expireAtMessage(dayUntilExpiring) {
  return Date.now() + 86400000 * dayUntilExpiring;
}

function findLastTimestamp(messages) {
  for (let i = messages.length; i >= 0; i--) {
    if (messages[i]?.type === 'timestamp') return messages[i];
  }
  return undefined;
}

conversationSchema.methods.seeingMessage = async function (userId) {
  if (!this.settings.messageView) return;

  const indexLastMessage = this.messages.length - 1;

  if (this.users[this.messages[indexLastMessage]?.sender]?.userId === userId) return;
  if (this.messages[indexLastMessage]?.viewedMessage !== false) return;

  this.messages[indexLastMessage].viewedMessage = true;

  this.markModified('messages');
  await this.save();
};

conversationSchema.methods.addUser = function (userId, conversationUsername, conversationPgp, { addUserId = true } = {}) {
  this.users.push({
    user: addUserId ? userId : undefined,
    userId,
    conversationUsername,
    conversationPgp,
  });
};

conversationSchema.methods.updateUserSettings = function (userId, messageExpiryDate, conversationPgp) {
  const indexUser = findUserIndex(this.users, userId);

  this.users[indexUser].messageExpiryDate = messageExpiryDate || undefined;
  this.users[indexUser].conversationPgp = conversationPgp || undefined;
};

conversationSchema.methods.updateConversationSettings = function (includeTimestamps, messageView, deleteEmpty, convoExpiryDate) {
  if (!this.settings) this.settings = {};

  this.settings.includeTimestamps = includeTimestamps;
  this.settings.messageView = messageView;
  this.settings.deleteEmpty = deleteEmpty;
  this.settings.daysUntilExpiring = this.settings.conversationPassword && (!convoExpiryDate || convoExpiryDate < 3) ? 3 : convoExpiryDate;

  this.updateConvoExpiryDate();
};

conversationSchema.methods.addConversationPassword = async function (plainTextPassword) {
  this.settings.conversationPassword = await bcrypt.hash(plainTextPassword, 12);
};

conversationSchema.methods.addTimeStamp = function () {
  if (this.settings.includeTimestamps) {
    const lastTimeStamp = findLastTimestamp(this.messages);

    if (!lastTimeStamp || Date.now() - lastTimeStamp.millisecondsTimestamp > 600000) { // 10 min
      this.messages.push({
        type: 'timestamp',
        timestamp: format(new Date(), 'HH:mm dd LLLL yyyy'),
        millisecondsTimestamp: Date.now(),
      });
    }
  }
};

conversationSchema.methods.removeUpdateReply = function (msgPosition, positionToShift) {
  for (let i = 0; i < this.messages.length; i++) {
    if (this.messages[i].reply == msgPosition) delete this.messages[i].reply;
    if (this.messages[i].reply >= msgPosition) this.messages[i].reply += -positionToShift;
  }
};

conversationSchema.methods.updateConvoExpiryDate = function () {
  if (this.settings.daysUntilExpiring) {
    this.settings.convoExpiryDate = expireAtMessage(this.settings.daysUntilExpiring);
  }
};

conversationSchema.methods.addMessageExpiryDate = function (msgPosition, messageExpiryDate) {
  if (messageExpiryDate && messageExpiryDate !== 'never') this.messages[msgPosition].expireAt = expireAtMessage(messageExpiryDate);
};

conversationSchema.methods.addReply = function (msgPosition, repliedMsgPosition) {
  if (repliedMsgPosition !== false) this.messages[msgPosition].reply = repliedMsgPosition;
};

conversationSchema.methods.addMessageView = function (msgPosition) {
  if (this.settings.messageView === true) this.messages[msgPosition].viewedMessage = false;
};

conversationSchema.methods.createNewMessage = function (content, sender, expiringInDays, { reply = false } = {}) {
  if (this.messages.length >= 1000) throw Error('Message Limit Reached');

  const senderIndex = findUserIndex(this.users, sender);

  this.addTimeStamp();

  this.messages.push({
    content,
    type: 'msg',
    sender: senderIndex,
  });

  const msgPosition = this.messages.length - 1;

  this.addMessageExpiryDate(msgPosition, this.users[senderIndex].messageExpiryDate || expiringInDays);
  this.addReply(msgPosition, reply);
  this.addMessageView(msgPosition);

  this.updateConvoExpiryDate();
};

conversationSchema.methods.editMessage = function (content, messagePosition, userId) {
  canCrudMessage(this.users[this.messages[messagePosition].sender]?.userId, userId);

  this.messages[messagePosition].content = content;
  this.markModified('messages');

  this.updateConvoExpiryDate();
};

conversationSchema.methods.emptyMessage = function () {
  if (this.settings.deleteEmpty) {
    if (!this.messages.length || !this.messages.map((message) => message.type).includes('msg')) {
      this.deleteConversation();
      return;
    }
  }

  this.save();
};

conversationSchema.methods.deleteMessage = function (msgPosition, userId, checkIfEmpty = true, canCRUD = true) {
  if (canCRUD) canCrudMessage(this.users[this.messages[msgPosition].sender]?.userId, userId);

  let deleteModifier = this.messages[msgPosition - 1]?.type === 'timestamp' ? 1 : 0;

  this.removeUpdateReply(msgPosition, 1 + deleteModifier);

  this.messages.splice(msgPosition - deleteModifier, 1 + deleteModifier);

  if (checkIfEmpty) this.emptyMessage();
};

conversationSchema.methods.deleteExpiredMessage = function (date) {
  for (let i = 0; i < this.messages.length; i++) {
    if (this.messages[i].expireAt <= date) this.deleteMessage(i, undefined, false, false);
  }
};

conversationSchema.methods.deleteConversation = async function () {
  await this.delete();
};

conversationSchema.statics.findAllConversationWithId = async function (ids, populate) {
  const conversations = [];

  if (ids) {
    for (let i = 0; i < ids.length; i++) {
      conversations.push(this.findById(ids[i].convoId).populate(populate));
    }
  }

  const returnedConversation = await Promise.all(conversations);

  return returnedConversation.filter((elem) => elem);
};

conversationSchema.statics.findAllConversationOfUser = async function (userId, { populate, hiddenConversationsId } = {}) {
  const conversations = await Promise.all([
    await this.findAllConversationWithId(hiddenConversationsId, populate),
    await this.find({ users: { $elemMatch: { user: userId } } }).populate(populate),
  ]);

  const returnedConversation = conversations[1];

  for (let i = 0; i < conversations[0].length; i++) {
    returnedConversation.unshift(conversations[0][i]);
  }

  return returnedConversation;
};

conversationSchema.statics.findConversationExist = async function (userId, id) {
  const conversations = await this.find({
    $and: [
      { 'users.userId': userId },
      { 'users.userId': id },
    ],
  });

  return conversations;
};

conversationSchema.statics.findConversationWithId = async function (id, populate) {
  const conversation = this.findOne({ 'users.userId': id }).populate(populate);

  return conversation;
};

module.exports = mongoose.model('Conversation', conversationSchema);
