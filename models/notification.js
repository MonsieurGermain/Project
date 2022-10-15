const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
});

notificationSchema.methods.createNotification = async function (userId, content) {
  this.userId = userId;
  this.content = content;

  this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);
