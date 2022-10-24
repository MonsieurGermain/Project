const ConversationModel = require('../../models/conversation');

const { deleteExpiredUncoveredIds, canCRUDConveration } = require('../../middlewares/function');

const deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;

    req.conversation = await ConversationModel.findById(id);

    const { user, conversation } = req;
    const hiddenConversationsId = req.session.hiddenConversationsId = deleteExpiredUncoveredIds(req.session.hiddenConversationsId);
    const userId = conversation.settings.conversationPassword && hiddenConversationsId && hiddenConversationsId.map((elem) => elem.convoId).includes(conversation.id) && conversation.users[1].userId !== user.id ? conversation.users[0].userId : user.id;

    canCRUDConveration(conversation, userId);

    await conversation.deleteConversation();

    res.redirect('/user/messages#bottom');
  } catch (e) {
    res.redirect(`/user/messages?id=${req.conversation.id}#bottom`);
  }
};

module.exports = { deleteConversation };
