const UserModel = require('../models/user');

async function sendNotification({
  userId,
  notificationType,
  notificationData,
}) {
  if (!userId || !notificationType) return console.log('Missing Information');

  const foundUser = await UserModel.findById(userId);

  if (!foundUser) return console.log('No User Found');

  if (
    foundUser.settings.notificationsSettings.sendNotification[notificationType]
  ) {
    foundUser.createNewNotification({ notificationType, notificationData });
  }
}

module.exports = sendNotification;
