const express = require('express');
const router = express.Router();
const Conversation = require('../models/conversation');
const User = require('../models/user');
const {Need_Authentification} = require('../middlewares/authentication');
const { Validate_Conversation, Validate_Message, sanitizeParams, sanitizeQuerys} = require('../middlewares/validation');
const {formatUsernameWithSettings} = require('../middlewares/function');

async function getOtherUserData(username) {
   const userData = await User.findOne({username: username}, {img_path: 1, verifiedPgpKeys: 1});
   return [userData.img_path, userData.verifiedPgpKeys];
}


router.post('/send-message/:username', Need_Authentification, sanitizeParams,
   (req,res, next) => { 
      if (req.params.username === req.user.username) {
         req.flash('error', 'You cant send a Message to Yourself');
         res.redirect(`/profile/${req.params.username}?productPage=1&reviewPage=1`);
      } else { 
         next()
      }
   }, Validate_Conversation,
   async (req, res) => {
      try {
         const {user} = req;
         const {username} = req.params;
         const {type, timestamps, message, pgpSettings, otherPgpKeys} = req.body;

         let conversation = await Conversation.isConversationExisting(user.username, username, type);


         if (!conversation) {
            conversation = new Conversation({
               sender_1: user.username,
               sender_2: username,
               sender1_Img: type === 'default' ? user.img_path : '/default/default-profile-pic.png',
               settings: { 
                  type: type ? type : 'default',
                  timestamps: timestamps ? true : undefined,
                  includePgp : pgpSettings ? true : undefined,
               }
            });

            switch (pgpSettings) {
               case 'ownPgp':
                  conversation.sender1_Pgp = req.user.verifiedPgpKeys;
                  break;
               case 'otherPgp':
                  conversation.sender1_Pgp = otherPgpKeys;
                  break;
            }

            [conversation.sender2_Img, conversation.sender2_Pgp] = await getOtherUserData(username);
         }

         conversation.Add_New_Message(message, user.username, user.settings);

         await conversation.save();

         res.redirect( `/messages?id=${conversation.id}#bottom`);
      } catch (e) {
         console.log(e)
         res.redirect('/404');
      }
   }
);

router.post('/messages/:id', Need_Authentification, sanitizeParams, Validate_Message,
   async (req, res) => {
      try { 
         const conversation = await Conversation.findByIdVerifyIfPartOfConversation(req.params.id, req.user.username)

         conversation.Add_New_Message(req.body.message, req.user.username, req.user.settings);

         await conversation.save();

         res.redirect(`/messages?id=${conversation.id}#bottom`);
      } catch (e) {
         res.redirect('/404');
      }
   }
);

router.post('/search-messages', Need_Authentification, async (req, res) => {
   try {
      let {search} = req.body;

      if (!search || search.length > 100) res.redirect('/messages#bottom');

      res.redirect(`/messages?searchQuery=${search}#bottom`);
   } catch (e) {
      res.redirect('/404');
   }
});

function putAuthUserAtSender_1(conversation, username) {
   originalSender_1 = formatUsernameWithSettings(conversation.sender_1, conversation.settings.type);

   if (username === conversation.sender_2) {
      savedSender1_Img = conversation.sender1_Img;
      savedSender1_Pgp = conversation.sender1_Pgp;

      conversation.sender_1 = username;
      conversation.sender_2 = originalSender_1;

      conversation.sender1_Img = conversation.sender2_Img;
      conversation.sender2_Img = savedSender1_Img;

      conversation.sender1_Pgp = conversation.sender2_Pgp;
      conversation.sender2_Pgp = savedSender1_Pgp;
   } else {
      conversation.sender_1 = originalSender_1;
   }

   return conversation;
}

async function formatConversations(conversations, username) {
   for (let i = 0; i < conversations.length; i++) {
      conversations[i] = putAuthUserAtSender_1(conversations[i], username); // Hide Username of Sender_1 and Set Current User to Sender 1 aferward
   }

   return conversations;
}

function getIndexSelectedConversation(conversations, conversationId) {
   if (!conversations.length) return undefined
   if (!conversationId) return conversations.length - 1;

   for (let i = 0; i < conversations.length; i++) {
      if (conversations[i].id === conversationId) return i;
   }
   return undefined;
}

function createRedirectLink(conversation, username) {
   if (conversation.sender_1 === username) return `/profile/${conversation.sender_2}?productPage=1&reviewPage=1`
   else if (conversation.settings.type === 'default') return `/profile/${conversation.sender_1}?productPage=1&reviewPage=1`
   return undefined
}


function addEditButton(conversation, username) {
   const whoIsUser = conversation.sender_1 === username ? formatUsernameWithSettings(conversation.sender_1, conversation.settings.type): conversation.sender_2 
   
   const addButtonIndex = []

   for(let i = 0; i < conversation.messages.length; i++){
      if (conversation.messages[i].sender === whoIsUser) {
         addButtonIndex.push(i)

         if (addButtonIndex.length > 5) addButtonIndex.splice(0, 1)
      }
   }
   return addButtonIndex
}

async function getSelectedConversationIndex(userConversations, selectedConversationId, username) {
   const position = getIndexSelectedConversation(userConversations, selectedConversationId)

   if (userConversations[position]) {
      userConversations[position].editButton = addEditButton(userConversations[position], username)
      userConversations[position].link = createRedirectLink(userConversations[position], username);
      if (userConversations[position].settings.type === 'default') await userConversations[position].sawMessages(username);
   }

   return [userConversations, position];
}

function filterConversationBySearch(userConversations, userUsername, searchQuery) {
   const filteredConversation = [];
   searchQuery = searchQuery.toLowerCase();

   for (let i = 0; i < userConversations.length; i++) {
      if (userConversations[i].settings.type === 'default' || userConversations[i].sender_1 === userUsername) {
         let otherUser;
         if (userConversations[i].sender_1 === userUsername) otherUser = userConversations[i].sender_2;
         else otherUser = userConversations[i].sender_1;

         if (otherUser.toLowerCase().match(searchQuery)) filteredConversation.push(userConversations[i]);
      }
   }
   return filteredConversation;
}

// GET PAGE
router.get('/messages', Need_Authentification, sanitizeQuerys, async (req, res) => {
   try {
      let {username} = req.user;
          id = req.query.id ? req.query.id : undefined,
          search = req.query.searchQuery ? req.query.searchQuery : undefined;

      let conversations = await Conversation.findAllUserConversations(username);

      if (search) conversations = filterConversationBySearch(conversations, username, search); // Optimize that

      [conversations, selectedConversationIndex] = await getSelectedConversationIndex(conversations, id, username);

      conversations = await formatConversations(conversations, username);

      res.render('messages', {
         conversations: conversations,
         selected_conversation: conversations[selectedConversationIndex],
      });
   } catch (e) {
      res.redirect('/404');
   }
});

router.post('/edit-message/:id/:messageId', Need_Authentification, sanitizeParams, Validate_Message, async (req, res) => {
   try {
      const conversation = await Conversation.findByIdVerifyIfPartOfConversation(req.params.id, req.user.username)

      const {message} = req.body;
      const {messageId} = req.params

      conversation.editMessage(messageId, message, req.user.username);

      await conversation.save()

      res.redirect(`/messages?id=${conversation.id}#bottom`);
   } catch (e) {
      res.redirect('/404');
   }
});

// DELETE
router.delete('/delete-conversation/:id', Need_Authentification, sanitizeParams, async (req, res) => {
   try {
      const conversation = await Conversation.findByIdVerifyIfPartOfConversation(req.params.id, req.user.username)

      await conversation.deleteConversation();

      res.redirect(`/messages#bottom`);
   } catch (e) {
      res.redirect('/404');
   }
});

async function getSender1_deleteEmptyConversation(username) {
   const otherUser = await User.findOne({username: username});
   return otherUser.settings.deleteEmptyConversation
}

// Make Prettier ?
router.delete('/delete-message/:id/:message_id', Need_Authentification, sanitizeParams,
   async (req, res) => {
      try {
         let {user} = req;

         const conversation = await Conversation.findByIdVerifyIfPartOfConversation(req.params.id, user.username)

         let {message_id} = req.params;

         conversation.deleteMessageWithId(message_id);

         if (!conversation.messages.length) {
            let deleteEmptyConversation = conversation.sender_1 === user.username ? user.settings.deleteEmptyConversation : await getSender1_deleteEmptyConversation(conversation.sender_1)

            if (deleteEmptyConversation) await conversation.deleteConversation();
            else await conversation.save();

         } else await conversation.save();

         res.redirect(conversation ? `/messages?id=${conversation.id}#bottom` : '/messages#bottom');
      } catch (e) {
         res.redirect('/404');
      }
   }
);

module.exports = router;
