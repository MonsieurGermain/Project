const express = require('express')
const router = express.Router()
const Conversation = require('../models/conversation')
const User = require('../models/user')
const { Need_Authentification } = require('../middlewares/authentication')
const { Validate_Conversation, Validate_Message } = require('../middlewares/input-validation')
const { Validate_Params_Username_Conversation, Validate_Params_Id_Conversation, Validate_Params_Username_Conversations, Validate_Query_Id_Conversations, Validate_Params_Message_Id_Conversation } = require('../middlewares/params-validator')
const { Validate_Send_Message_To_Himself } = require('../middlewares/custom-validation')
const { Validate_Conversation, Validate_Message, Validate_Params_Username_Conversation, Validate_Params_Id_Conversation, Validate_Params_Username_Conversations, Validate_Query_Id_Conversations, Validate_Params_Message_Id_Conversation, Sending_toHimself } = require('../middlewares/validation')
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

async function Format_Conversation(conversations, username, id) {
    
    const indexOf_SelectedConversation = Get_IndexOf(conversations, id) // Get Index of The Selected Conversation
    if (indexOf_SelectedConversation || indexOf_SelectedConversation === 0) conversations[indexOf_SelectedConversation] = Create_Link(conversations[indexOf_SelectedConversation], username) // If Index Format Selected Conversation

    for(let i = 0; i < conversations.length; i++) {

    conversations[i].img_path = await Get_User_Img_Path(conversations[i], username) // Get Img Path Of the Conversation Partner

    conversations[i] = Format_Username(conversations[i], username) // Hide Username of Sender_1 and Set Current User to Sender 1 aferward
    }

    return {formated_conversations: conversations, index_selectedConversation: indexOf_SelectedConversation}
}




// CREATE MESSAGE
router.post('/send-message/:username', 
Need_Authentification, Sending_toHimself, Validate_Conversation, Validate_Params_Username_Conversation,
async (req, res) => {
    try {       
        const { Found_Conversation } = req

        const New_Or_Updated_Conversation = Create_Or_Update_Conversation(Found_Conversation, req.body, req.user.username, req.params.username, req.user.settings.message_expiring)
        await New_Or_Updated_Conversation.save()

        res.redirect('/messages')

    } catch (e) {
        console.log(e)
        res.redirect('/error')
        return
    }
})


router.post('/messages/:id',
Need_Authentification, Validate_Params_Id_Conversation, Validate_Message,
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
Need_Authentification, Validate_Params_Username_Conversations, Validate_Query_Id_Conversations,
async (req, res) => {
    try {
        let { conversations } = req
        const {formated_conversations, index_selectedConversation} = await Format_Conversation(conversations, req.user.username, req.query.id) // Function Format All Conversation and Return IndexOf Selected Conversaiotn

        res.render('messages', {conversations: formated_conversations,  selected_conversation: formated_conversations[index_selectedConversation]})

    } catch (e) {
        console.log(e)
        res.redirect('/404')
        return
    }
})



// DELETE
router.delete('/delete-conversation/:id', 
Need_Authentification, Validate_Params_Id_Conversation,
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
Need_Authentification, Validate_Params_Id_Conversation, Validate_Params_Message_Id_Conversation,
async (req, res) => {
    try {
        let { conversation } = req

        await conversation.Delete_Message(req.params.message_id) 

        let redirect_url = `/messages?id=${conversation.id}`
        if (!conversation.messages.length) redirect_url = '/messages'

        if (!conversation.messages.length) await conversation.delete()
        else await conversation.save()

        res.redirect(redirect_url)

    } catch (e) {
        console.log(e)
        res.redirect('/error')
        return
    }
})




module.exports = router