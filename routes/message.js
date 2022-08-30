const express = require('express');
const router = express.Router();
const Conversation = require('../models/conversation');
const User = require('../models/user');
const {Need_Authentification} = require('../middlewares/authentication');
const {
   Validate_Conversation,
   Validate_Message,
   Find_ifConversation_alreadyExist,
   FetchData,
   isPartofConversation,
   Find_allConverastion_ofUser,
   isHimself,
} = require('../middlewares/validation');
const {Format_Username_Settings} = require('../middlewares/function');

function Create_Or_Update_Conversation(Found_Conversation, body, Sender, To_User, userSettings) {
   if (!Found_Conversation) return new Conversation().Create_Conversation(body, Sender, To_User, userSettings); // If Convo Doesnt Exist Create One
   return Found_Conversation.Add_New_Message(body.message, Sender, userSettings); // If Convo Exist add new Message
}

// CREATE MESSAGE
router.post(
   '/send-message/:username',
   Need_Authentification,
   isHimself(
      {
         url: ['/profile/', ['user', 'username'], '?productPage=1&reviewPage=1'],
         message: 'You cant send a Message to Yourself',
      },
      ['params', 'username']
   ),
   Validate_Conversation,
   Find_ifConversation_alreadyExist,
   async (req, res) => {
      try {
         const {Found_Conversation} = req;

         const New_Or_Updated_Conversation = Create_Or_Update_Conversation(Found_Conversation, req.body, req.user.username, req.params.username, req.user.settings);
         await New_Or_Updated_Conversation.save();

         let redirect_url = '/messages';
         if (Found_Conversation) redirect_url = `/messages?id=${Found_Conversation.id}`;
         res.redirect(redirect_url);
      } catch (e) {
         console.log(e);
         res.redirect('/error');
         return;
      }
   }
);

router.post(
   '/messages/:id',
   Need_Authentification,
   FetchData(['params', 'id'], Conversation, undefined, 'conversation'),
   isPartofConversation,
   Validate_Message,
   async (req, res) => {
      try {
         const {conversation} = req;

         conversation.Add_New_Message(req.body.message, req.user.username, req.user.settings);
         await conversation.save();

         res.redirect(`/messages?id=${conversation.id}`);
      } catch (e) {
         console.log(e);
         res.redirect('/error');
         return;
      }
   }
);

router.post('/search-messages', Need_Authentification, async (req, res) => {
   try {
      let {search} = req.body;

      if (!search || search.length > 100) {
         res.redirect('/messages');
      } // Maybe send an alert to user ?

      res.redirect(`/messages?searchQuery=${search}`);
   } catch (e) {
      console.log(e);
      res.redirect('/404');
      return;
   }
});

async function getUserProfilePic(username) {
   const user = await User.findOne({username: username});
   return user.img_path;
}

async function getConversationPartner_ProfilePic(conversation, username) {
   if (conversation.sender_1 === username) return await getUserProfilePic(conversation.sender_2);
   if (conversation.settings.type === 'default') return await getUserProfilePic(conversation.sender_1);
   else return '/default/default.png';
}

function formatUsernames(sender_1, sender_2, settings, username) {
   sender_1 = Format_Username_Settings(sender_1, settings);

   if (username === sender_2) return [sender_2, sender_1];
   else return [sender_1, sender_2];
}

async function formatConversations(conversations, username) {
   for (let i = 0; i < conversations.length; i++) {
      conversations[i].img_path = await getConversationPartner_ProfilePic(conversations[i], username); // Get Img Path Of the Conversation Partner
      [conversations[i].sender_1, conversations[i].sender_2] = formatUsernames(conversations[i].sender_1, conversations[i].sender_2, conversations[i].settings.type, username); // Hide Username of Sender_1 and Set Current User to Sender 1 aferward
   }

   return conversations;
}

function getPosition(conversations, id) {
   for (let i = 0; i < conversations.length; i++) {
      if (conversations[i].id === id) return i;
   }
   return undefined;
}

function createRedirectLink(conversation, username) {
   let linkedUsername;
   if (conversation.sender_1 === username) linkedUsername = conversation.sender_2;
   else if (conversation.settings.type === 'default') linkedUsername = conversation.sender_1;

   return linkedUsername ? `/profile/${linkedUsername}?productPage=1&reviewPage=1` : undefined;
}

async function getSelectedConversationPosition(userConversations, selectedConversationId, username) {
   let position;

   if (!selectedConversationId && !userConversations.length) position = undefined;
   else if (!selectedConversationId) position = userConversations.length - 1;
   else position = getPosition(userConversations, selectedConversationId);

   if (userConversations[position]) {
      userConversations[position].link = createRedirectLink(userConversations[position], username);
      await userConversations[position].sawMessages(username);
   }

   return [userConversations, position];
}

function filterConversationBySearch(userConversations, userUsername, searchQuery) {
   const filteredConversation = [];
   searchQuery = searchQuery.toLowerCase();

   for (let i = 0; i < userConversations.length; i++) {
      if (userConversations[i].settings.type === 'default') {
         let otherUser;
         if (userConversations[i].sender_1 === userUsername) otherUser = userConversations[i].sender_2;
         else otherUser = userConversations[i].sender_1;

         if (otherUser.toLowerCase().match(searchQuery)) filteredConversation.push(userConversations[i]);
      }
   }
   return filteredConversation;
}

// GET PAGE
router.get('/messages', Need_Authentification, Find_allConverastion_ofUser, async (req, res) => {
   try {
      let {conversations} = req;
      let {username} = req.user;
      let id = req.query.id ? req.query.id : undefined;
      let search = req.query.searchQuery ? req.query.searchQuery : undefined;

      if (search) conversations = filterConversationBySearch(conversations, username, search);

      [conversations, selectedConversationPosition] = await getSelectedConversationPosition(conversations, id, username);

      conversations = await formatConversations(conversations, username);

      res.render('messages', {
         conversations: conversations,
         selected_conversation: conversations[selectedConversationPosition],
      });
   } catch (e) {
      console.log(e);
      res.redirect('/404');
      return;
   }
});

router.post('/edit-message/:id/:messageId', Need_Authentification, FetchData(['params', 'id'], Conversation, undefined, 'conversation'), isPartofConversation, async (req, res) => {
   try {
      const {conversation} = req;
      const {messageId} = req.params;
      const {newMessage} = req.body;

      if (newMessage.length < 2 || newMessage.length > 1000) throw new Error('Invalid New Message Length');

      await conversation.editMessage(messageId, newMessage);

      res.redirect(`/messages?id=${conversation.id}#bottom`);
   } catch (e) {
      console.log(e);
      res.redirect('/error');
      return;
   }
});

// DELETE
router.delete('/delete-conversation/:id', Need_Authentification, FetchData(['params', 'id'], Conversation, undefined, 'conversation'), isPartofConversation, async (req, res) => {
   try {
      const {conversation} = req;

      await conversation.deleteConversation();

      res.redirect(`/messages`);
   } catch (e) {
      console.log(e);
      res.redirect('/error');
      return;
   }
});

router.delete(
   '/delete-message/:id/:message_id',
   Need_Authentification,
   FetchData(['params', 'id'], Conversation, undefined, 'conversation'),
   isPartofConversation,
   async (req, res) => {
      try {
         let {conversation, user} = req;
         let {message_id} = req.params;

         conversation.deleteMessageWithId(message_id);

         let redirect_url;

         if (!conversation.messages.length) {
            let settingsdeleteEmptyConversation;
            if (conversation.sender_1 === user.username) settingsdeleteEmptyConversation = user.settings.deleteEmptyConversation;
            else {
               const otherUser = await User.findOne({username: conversation.sender_1});
               settingsdeleteEmptyConversation = otherUser ? otherUser.settings.deleteEmptyConversation : true;
            }

            if (settingsdeleteEmptyConversation) await conversation.deleteConversation();
            else await conversation.save();

            redirect_url = '/messages';
         } else {
            redirect_url = `/messages?id=${conversation.id}`;
            await conversation.save();
         }

         res.redirect(redirect_url);
      } catch (e) {
         console.log(e);
         res.redirect('/error');
         return;
      }
   }
);

module.exports = router;
