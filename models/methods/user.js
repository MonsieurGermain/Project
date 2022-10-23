const ConversationModel = require('../conversation');
const StepVerification = require('../2step-verification');
const Contactus = require('../contactus');
const Report = require('../report');
const Product = require('../product');
const Review = require('../review');
const { deleteImage } = require('../../middlewares/filesUploads');
const { notificationsTypes } = require('../../constants/notifications');

function expireAtNotifications(days) {
  if (!days) return;
  if (days < 0) return -1;
  return Date.now() + 86400000 * days;
}

function deleteNotification({ notificationId }) {
  const notificationIndex = this.notifications.map((elem) => elem.id).indexOf(notificationId);

  if (notificationIndex === -1) {
    console.log('Invalid Notification Id');
    return;
  }

  this.notifications.splice(notificationIndex, 1);
}

function sawNotification() {
  for (let i = 0; i < this.notifications.length; i++) {
    if (!this.notifications[i]) continue;
    if (this.notifications[i].sawNotification === false) this.notifications[i].sawNotification = true;
  }
}

function deleteExpiredNotifications(date) {
  for (let i = this.notifications.length - 1; i > -1; i--) {
    if (this.notifications[i]?.expireAt < date) this.notifications.splice(i, 1);
  }
}

function deleteOnSeeNotification() {
  for (let i = this.notifications.length - 1; i > -1; i--) {
    if (this.notifications[i]?.expireAt === -1) this.notifications.splice(i, 1);
  }
}

function createNewNotification({ notificationType, notificationData }) {
  const { action, details } = notificationsTypes[notificationType](notificationData);

  const userSettings = this.settings.notificationsSettings;

  const newNotification = {
    action,
    details,
    sawNotification: userSettings.sawNotification ? false : undefined,
    expireAt: expireAtNotifications(this.settings.notificationsSettings.expiryDate),
  };

  this.notifications.unshift(newNotification);
  this.notifications.splice(this.authorization === 'buyer' ? 49 : 500, 1); // Delete 50 notification

  this.save();
}

function updateInactiveDate() {
  this.expire_at = Date.now() + this.settings.userExpiring * 86400000;
}

function addRemoveSavedProducts(id) {
  if (this.saved_product.includes(id)) this.saved_product = this.saved_product.filter((element) => element !== id);
  // Remove
  else this.saved_product.push(id); // Add
}

async function offlineAllUserProducts() {
  const userProducts = await Product.find({ vendor: this.username });

  for (let i = 0; i < userProducts.length; i++) {
    if (!userProducts[i].customMoneroAddress) {
      userProducts[i].status = 'offline';
      userProducts[i].save();
    }
  }
}

async function deleteUser() {
  deleteImage(`./uploads${this.img_path}`);

  // Delete Conversations
  const conversations = await ConversationModel.find({
    $or: [{ sender_1: this.username }, { sender_2: this.username }],
  });

  for (let i = 0; i < conversations.length; i++) {
    conversations[i].deleteConversation();
  }

  // Product
  const products = await Product.find({ vendor: this.username });
  for (let i = 0; i < products.length; i++) {
    products[i].deleteProduct();
  }

  // Review
  const review = await Review.find({ sender: this.username });
  for (let i = 0; i < review.length; i++) {
    review[i].deleteReview();
  }

  // Report
  const reports = await Report.find({ $or: [{ reference_id: this.username }, { username: this.username }] });
  for (let i = 0; i < reports.length; i++) {
    reports[i].deleteReport();
  }

  // Contact Us
  const contactus = await Contactus.find({ username: this.username });
  for (let i = 0; i < contactus.length; i++) {
    contactus[i].deleteContactUs();
  }

  // 2 Step Verification
  const stepVerification = await StepVerification.find({ username: this.username });
  for (let i = 0; i < stepVerification.length; i++) {
    stepVerification[i].deleteStepVerification();
  }

  await this.delete();
}

const setUserMethodsToSchema = (userSchema) => {
  userSchema.methods = {
    sawNotification,
    deleteExpiredNotifications,
    deleteOnSeeNotification,
    deleteNotification,
    createNewNotification,
    updateInactiveDate,
    addRemoveSavedProducts,
    offlineAllUserProducts,
    deleteUser,
  };
};

module.exports = { setUserMethodsToSchema };
