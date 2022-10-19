const express = require('express');

const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/user');
const { ConversationModel } = require('../models/conversation');
const { isAuth } = require('../middlewares/authentication');
const { generateRandomString } = require('../middlewares/function');
const {
  sanitizeConversationInput,
  changeUserSettingsConversation,
  sanitizeHiddenConversationInput,
  sanitizeMessageInput,
  sanitizeParams,
  sanitizeQuerys,
  sanitizeParamsQuerys,
  changeSettingsConversation,
  sanitizeSearchInput,
} = require('../middlewares/validation');

function getIndexSelectedConversation(conversations, conversationId) {
  const index = conversations.map((conversation) => conversation.id).indexOf(conversationId);

  if (index === -1 && !conversations.length) return -1;
  if (index === -1) return conversations.length - 1;
  return index;
}

function canCRUDConveration(conversation, userId) {
  for (let i = 0; i < conversation.users.length; i++) {
    if (conversation.users[i].userId === userId) return;
  }
  throw Error('You dont have the Permission to do this Action');
}

function deleteExpiredUncoveredIds(uncoveredId) {
  if (uncoveredId?.length) {
    for (let i = 0; i < uncoveredId.length; i++) {
      if (uncoveredId[i].timeToLive < Date.now()) {
        uncoveredId.splice(i, 1);
        i -= 1;
      } else {
        uncoveredId[i].timeToLive = Date.now() + 600000;
      }
    }
  }

  return uncoveredId;
}

function conversationAlreadyExist(conversations, userId, otherUserId, conversationUsername) {
  for (let i = 0; i < conversations.length; i++) {
    if (!conversations[i].users[0].conversationUsername && !conversationUsername) {
      if (conversations[i].users[0].userId === userId && conversations[i].users[1].userId === otherUserId) return [conversations[i], 0];
      if (conversations[i].users[1].userId === userId && conversations[i].users[0].userId === otherUserId) return [conversations[i], 1];
    } else if (conversations[i].users[0].userId === userId) {
      if (conversations[i].users[0].conversationUsername === conversationUsername) {
        return [conversations[i], 0];
      }
    }
  }
  return [new ConversationModel({}), 0];
}

// GET PAGE
router.get('/messages', isAuth, sanitizeQuerys, async (req, res) => {
  try {
    const { user } = req;
    const id = req.query.id || undefined;

    const hiddenConversationsId = req.session.hiddenConversationsId = deleteExpiredUncoveredIds(req.session.hiddenConversationsId);

    let conversations = await ConversationModel.findAllConversationOfUser({ userId: user.id, populate: 'users.user', ids: hiddenConversationsId });

    const selectedConversation = conversations[getIndexSelectedConversation(conversations, id)];

    if (selectedConversation) {
      await selectedConversation.seeingMessage({ userId: user.id });
    }

    res.render('Pages/messagePages/messages', {
      conversations,
      selectedConversation,
    });
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.get('/create-hidden-conversation', sanitizeQuerys, async (req, res) => {
  try {
    res.render('Pages/messagePages/createHiddenConversation', { randomId: generateRandomString(30, 'letterAndnumber') });
  } catch (e) {
    console.log(e);
    res.redirect('/404');
  }
});

router.get('/change-user-conversation-settings/:id', isAuth, sanitizeParams, async (req, res) => {
  try {
    const { id } = req.params;

    req.conversation = await ConversationModel.findById(id).populate('users.user');

    const { conversation } = req;

    res.render('Pages/messagePages/changeUserSettings', { conversation });
  } catch (e) {
    console.log(e);
    res.redirect(`/messages?id=${req.conversation.id}#bottom`);
  }
});

router.post(
  '/create-conversation/:id',
  isAuth,
  sanitizeParams,
  async (req, res, next) => {
    if (req.params.id !== req.user.id) next();
    else {
      req.flash('error', 'You cant send a Message to Yourself');
      res.redirect(`/user/profile/${req.user.username}?productPage=1&reviewPage=1`);
    }
  },
  sanitizeConversationInput,
  async (req, res) => {
    try {
      const { user } = req;
      const {
        includeTimestamps, messageView, deleteEmpty, convoExpiryDate,
      } = user.settings.messageSettings;
      const {
        content, conversationUsername, conversationPgp,
      } = req.body;
      const { id } = req.params;

      if (await ConversationModel.countDocuments({ 'users.userId': user.id }) >= 100) throw new Error('You cant have more than 100 conversation');

      let newConversation = await ConversationModel.findConversationExist({ userId: user.id, id });

      if (newConversation.filter((conversation) => conversation.users[0].userId === user.id || (!conversation.users[0].conversationUsername && conversation.users[1].userId === user.id)).length >= 5) throw Error('You cant create more than 5 conversation with each user');

      let [conversation, userPosition] = conversationAlreadyExist(newConversation, user.id, id, conversationUsername);

      if (!conversation.users.length) {
        conversation.updateConversationSettings({
          includeTimestamps,
          messageView,
          deleteEmpty,
          convoExpiryDate,
        });

        conversation.addUser({ userId: user.id, conversationUsername, conversationPgp });
        conversation.addUser({ userId: id });
      }

      conversation.createNewMessage(content, conversation.users[userPosition].userId, user.settings.messageSettings.messageExpiryDate);

      await conversation.save();

      res.redirect(`/messages?id=${conversation.id}#bottom`);
    } catch (e) {
      console.log(e);
      const user = await User.findById(req.params.id);

      req.flash('error', e.message);
      res.redirect(`/user/profile/${user.username}?productPage=1&reviewPage=1`);
    }
  },
);

router.post(
  '/create-hidden-conversation/:id',
  isAuth,
  sanitizeParams,
  async (req, res, next) => {
    if (req.query.id !== req.user.id) next();
    else {
      req.flash('error', 'You cant send a Message to Yourself');
      res.redirect(`/user/profile/${req.user.username}?productPage=1&reviewPage=1`);
    }
  },
  sanitizeHiddenConversationInput,
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        content, conversationId, conversationPassword, conversationUsername, conversationPgp, convoExpiryDate, messageExpiryDate,
      } = req.body;

      const conversation = await ConversationModel.findConversationWithId({ id: conversationId });
      if (conversation) throw Error('Invalid Id, Please try a differrent one');

      const newHiddenConversation = new ConversationModel({});

      newHiddenConversation.updateConversationSettings({
        deleteEmpty: true,
        convoExpiryDate,
      });

      await newHiddenConversation.addConversationPassword({ conversationPassword });

      newHiddenConversation.addUser({
        userId: conversationId, conversationUsername, conversationPgp, addUserId: false,
      });
      newHiddenConversation.addUser({ userId: id });

      newHiddenConversation.users[0].messageExpiryDate = messageExpiryDate;

      newHiddenConversation.createNewMessage(content, conversationId, messageExpiryDate);

      await newHiddenConversation.save();

      req.flash('success', `  
      <p class="mb-0">Hidden Converstion Successfully Created</p>
      <p class="mb-0">Conversation Id: <b>${conversationId}</b></p>
      <p class="fs-xs mb-0"> Save this id and your password somewhere safe and dont lose it, or you will lose access to this conversation</p>
      <a href='/docs/' class="fs-xs">How do I access this conversation ?</a>
      `);
      res.redirect(`/create-hidden-conversation?id=${id}`);
    } catch (e) {
      console.log(e);
      req.flash('error', e.message);
      res.redirect(`/create-hidden-conversation?id=${req.params.id}`);
    }
  },
);

router.post(
  '/messages/:id',
  isAuth,
  sanitizeParamsQuerys,
  sanitizeMessageInput,
  async (req, res) => {
    try {
      const { id } = req.params;

      req.conversation = await ConversationModel.findById(id);

      const { user, conversation } = req;
      const { command } = req.body;
      const hiddenConversationsId = req.session.hiddenConversationsId = deleteExpiredUncoveredIds(req.session.hiddenConversationsId);
      const userId = conversation.settings.conversationPassword && hiddenConversationsId && hiddenConversationsId.map((elem) => elem.convoId).includes(conversation.id) && conversation.users[1].userId !== user.id ? conversation.users[0].userId : user.id;

      switch (command[0]) {
        case 'msg':
          conversation.createNewMessage(command[1], userId, user.settings.messageSettings.messageExpiryDate);
          break;
        case 'edit':
          conversation.editMessage(command[2], command[1], userId);
          break;
        case 'reply':
          conversation.createNewMessage(command[2], userId, user.settings.messageSettings.messageExpiryDate, { reply: command[1] });
          break;
        case 'delete':
          conversation.deleteMessage(command[1], userId);

          res.redirect(`/messages?id=${conversation.id}#bottom`);
          return;
      }

      await conversation.save();

      res.redirect(`/messages?id=${conversation.id}#bottom`);
    } catch (e) {
      console.log(e);
      res.redirect(`/messages?id=${req.conversation.id}#bottom`);
    }
  },
);

router.post('/search-conversation', isAuth, sanitizeSearchInput, async (req, res) => {
  try {
    const { searchInput } = req.body;

    const conversation = await ConversationModel.findConversationWithId({ id: searchInput[0] });

    if (conversation?.settings.conversationPassword) {
      if (!await bcrypt.compare(searchInput[1], conversation.settings.conversationPassword)) throw new Error('Invalid Password');

      const uncoveredConvo = {
        convoId: conversation.id,
        timeToLive: Date.now() + 600000, // 10 min
      };

      if (!req.session.hiddenConversationsId) req.session.hiddenConversationsId = [];
      req.session.hiddenConversationsId.push(uncoveredConvo);
    }

    res.redirect(`/messages?id=${conversation.id}#bottom`);
  } catch (e) {
    console.log(e);
    res.redirect('/messages#bottom');
  }
});

// DELETE
router.post('/delete-conversation/:id', isAuth, sanitizeParams, async (req, res) => {
  try {
    const { id } = req.params;

    req.conversation = await ConversationModel.findById(id);

    const { user, conversation } = req;
    const hiddenConversationsId = req.session.hiddenConversationsId = deleteExpiredUncoveredIds(req.session.hiddenConversationsId);
    const userId = conversation.settings.conversationPassword && hiddenConversationsId && hiddenConversationsId.map((elem) => elem.convoId).includes(conversation.id) && conversation.users[1].userId !== user.id ? conversation.users[0].userId : user.id;

    canCRUDConveration(conversation, userId);

    await conversation.deleteConversation();

    res.redirect('/messages#bottom');
  } catch (e) {
    res.redirect(`/messages?id=${req.conversation.id}#bottom`);
  }
});

router.post('/change-conversation-settings/:id', isAuth, sanitizeParams, changeSettingsConversation, async (req, res) => {
  try {
    const { id } = req.params;

    req.conversation = await ConversationModel.findById(id);

    const { user, conversation } = req;
    let {
      includeTimestamps, messageView, deleteEmpty, convoExpiryDate,
    } = req.body;

    const hiddenConversationsId = req.session.hiddenConversationsId = deleteExpiredUncoveredIds(req.session.hiddenConversationsId);
    const userId = conversation.settings.conversationPassword && hiddenConversationsId && hiddenConversationsId.map((elem) => elem.convoId).includes(conversation.id) && conversation.users[1].userId !== user.id ? conversation.users[0].userId : user.id;

    if (conversation.users[0].userId === userId) {
      if (conversation.settings.conversationPassword) {
        includeTimestamps = undefined;
        messageView = undefined;
        deleteEmpty = true;
        convoExpiryDate = !convoExpiryDate || convoExpiryDate < 3 ? 3 : convoExpiryDate || undefined;
      }

      conversation.updateConversationSettings({
        includeTimestamps,
        messageView,
        deleteEmpty,
        convoExpiryDate,
      });

      await conversation.emptyMessage();
    }

    res.redirect(`/messages?id=${conversation.id}#bottom`);
  } catch (e) {
    console.log(e);
    res.redirect(`/messages?id=${req.conversation.id}#bottom`);
  }
});

router.post('/change-user-conversation-settings/:id', isAuth, sanitizeParams, changeUserSettingsConversation, async (req, res) => {
  try {
    const { id } = req.params;

    req.conversation = await ConversationModel.findById(id).populate('users.user');

    const { user, conversation } = req;
    const { messageExpiryDate, conversationPgp } = req.body;

    const hiddenConversationsId = req.session.hiddenConversationsId = deleteExpiredUncoveredIds(req.session.hiddenConversationsId);
    const userId = conversation.settings.conversationPassword && hiddenConversationsId && hiddenConversationsId.map((elem) => elem.convoId).includes(conversation.id) && conversation.users[1].userId !== user.id ? conversation.users[0].userId : user.id;

    conversation.updateUserSettings({
      userId,
      messageExpiryDate,
      conversationPgp,
    });

    await conversation.save();

    res.redirect(`/messages?id=${conversation.id}#bottom`);
  } catch (e) {
    console.log(e);
    res.redirect(`/messages?id=${req.conversation.id}#bottom`);
  }
});

module.exports = router;
