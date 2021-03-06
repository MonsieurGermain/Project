const express = require('express')
const router = express.Router()
const Conversation = require('../models/conversation')
const User = require('../models/user')
const { Need_Authentification } = require('../middlewares/authentication')
const { Validate_Conversation, Validate_Message, Find_ifConversation_alreadyExist, FetchData, isPartofConversation, Find_allConverastion_ofUser, Validate_SelectedConversation_Id, ValidateDelete_MessageId, isHimself } = require('../middlewares/validation')
const { Format_Username_Settings } = require('../middlewares/function')

// Perfect that ?
async function Get_Img(username) {
    const user = await User.findOne({username: username})
    return user.img_path
}

async function Get_User_Img_Path(conversation, username) {
    let img_path = '/default/default.png'

    if (conversation.sender_1 === username) img_path = await Get_Img(conversation.sender_2)
    else if (conversation.settings.type === 'default') img_path = await Get_Img(conversation.sender_1)

    return img_path
}
//

function Create_Or_Update_Conversation(Found_Conversation, body, Sender, To_User, Message_Expiring_Settings) {
    if (!Found_Conversation) return new Conversation().Create_Conversation(body, Sender, To_User, Message_Expiring_Settings) // If Convo Doesnt Exist Create One
    return Found_Conversation.Add_New_Message(body.message, Sender, Message_Expiring_Settings) // If Convo Exist add new Message
}

function Format_Username(conversation, username) {
    const sender_1_formated = Format_Username_Settings(conversation.sender_1, conversation.settings.type)

    if (conversation.sender_1 === username) {
        conversation.sender_1 = sender_1_formated  // If Sender 1, Hide Username
    } else {
        conversation.sender_1 = username // If Sender 2 Put Himself Sender 1
        conversation.sender_2 = sender_1_formated // Hide The True Sender 1
    }
    return conversation
}

function Create_Link(conversation, username) {
    if (conversation.sender_1 === username) conversation.link = `/profile/${conversation.sender_2}?productPage=1&reviewPage=1` // if Sender 1 Link to Sender 2
    else {
        if (conversation.settings.type === 'default') { 
            conversation.link = `/profile/${conversation.sender_1}?productPage=1&reviewPage=1` // if Sender 2 and Type : Default Link to Sender 1
        }
    }
    return conversation
}

function Get_IndexOf(conversations, id) {
    if (id) return conversations.map(function(element) { return element.id; }).indexOf(id); // Return Index of selected Conversation
    if (!id && conversations.length) return conversations.length - 1 // If no Id, Selected Conversation Become Last Element
    return // If no Id and No Conversation return Nothing
}

async function Delete_onSeeing_Message(conversation, username) {
    const isSender_2 = conversation.sender_2 === username ? true : false 
    for(let i = 0; i < conversation.messages.length; i++) {
        if (isSender_2) {
            if (conversation.messages[i].expire_at === 'seeing' && conversation.messages[i].sender !== conversation.messages[i].sender_2) conversation.messages[i].expire_at = 1
        } else { 
            if (conversation.messages[i].expire_at === 'seeing' && conversation.messages[i].sender === conversation.messages[i].sender_2) conversation.messages[i].expire_at = 1
        }
    }
    await conversation.save()
}

async function Format_Conversation(conversations, username, id) {
    
    const index_selectedConversation = Get_IndexOf(conversations, id) // Get Index of The Selected Conversation

    // Manipulate Selected Conversation
    if (index_selectedConversation || index_selectedConversation === 0) conversations[index_selectedConversation] = Create_Link(conversations[index_selectedConversation], username) // If Index Format Selected Conversation
    if (conversations[index_selectedConversation]) await Delete_onSeeing_Message(conversations[index_selectedConversation], username)

    for(let i = 0; i < conversations.length; i++) {
    conversations[i].img_path = await Get_User_Img_Path(conversations[i], username) // Get Img Path Of the Conversation Partner
    conversations[i] = Format_Username(conversations[i], username) // Hide Username of Sender_1 and Set Current User to Sender 1 aferward
    }

    return [conversations, index_selectedConversation]
}


// CREATE MESSAGE
router.post('/send-message/:username', 
Need_Authentification, isHimself({url: ['/profile/', ['user', 'username'], '?productPage=1&reviewPage=1'], message: 'You cant send a Message to Yourself'}, ['params', 'username']), Validate_Conversation, Find_ifConversation_alreadyExist,
async (req, res) => {
    try {       
        const { Found_Conversation } = req

        const New_Or_Updated_Conversation = Create_Or_Update_Conversation(Found_Conversation, req.body, req.user.username, req.params.username, req.user.settings.message_expiring)
        await New_Or_Updated_Conversation.save()

        let redirect_url = '/messages'
        if (Found_Conversation) redirect_url = `/messages?id=${Found_Conversation.id}` 
        res.redirect(redirect_url)

    } catch (e) {
        console.log(e)
        res.redirect('/error')
        return
    }
})


router.post('/messages/:id',
Need_Authentification, FetchData(['params', 'id'], Conversation, undefined, 'conversation'), isPartofConversation, Validate_Message,
async (req, res) => {
    try {
        const { conversation } = req

        conversation.Add_New_Message(req.body.message, req.user.username, req.user.settings.message_expiring)
        await conversation.save()

        res.redirect(`/messages?id=${conversation.id}`)

    } catch (e) {
        console.log(e)
        res.redirect('/error')
        return
    }
})



// GET PAGE
router.get('/messages',
Need_Authentification, Find_allConverastion_ofUser, Validate_SelectedConversation_Id,
async (req, res) => {
    try {
        let { conversations } = req
        const [formated_conversations, index_selectedConversation] = await Format_Conversation(conversations, req.user.username, req.query.id) // Function Format All Conversation and Return IndexOf Selected Conversaiotn

        res.render('messages', {conversations: formated_conversations,  selected_conversation: formated_conversations[index_selectedConversation]})

    } catch (e) {
        console.log(e)
        res.redirect('/404')
        return
    }
})



// DELETE
router.delete('/delete-conversation/:id', 
Need_Authentification, FetchData(['params', 'id'], Conversation, undefined, 'conversation'), isPartofConversation,
async (req, res) => {
    try {
        const {conversation} = req
        await conversation.delete()

        res.redirect(`/messages`)
    } catch (e) {
        console.log(e)
        res.redirect('/error')
        return
    }
})


router.delete('/delete-message/:id/:message_id', 
Need_Authentification, FetchData(['params', 'id'], Conversation, undefined, 'conversation'), isPartofConversation, ValidateDelete_MessageId,
async (req, res) => {
    try {
        let { conversation } = req

        let redirect_url
        switch(conversation.messages.length) {
            case 0 :
                redirect_url = '/messages'
                await conversation.delete()
            break
            default :
            redirect_url =  `/messages?id=${conversation.id}` 
            await conversation.save()
        }
        
        res.redirect(redirect_url)

    } catch (e) {
        console.log(e)
        res.redirect('/error')
        return
    }
})




module.exports = router