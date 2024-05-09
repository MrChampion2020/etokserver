
const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  senderId: {
    type: String,
    required: true,
  },
  receiverId: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const Chat = mongoose.model("Chat", chatSchema);

const saveMessage = async (senderId, receiverId, message) => {
  try {
    const newChat = new Chat({
      senderId,
      receiverId,
      message,
    });

    await newChat.save();
    console.log("Message saved successfully");
  } catch (error) {
    console.error("Error saving message", error);
  }
};

const getMessages = async (chatId) => {
  try {
    const messages = await Chat.find({ chatId });
    return messages;
  } catch (error) {
    console.error("Error getting messages", error);
    return [];
  }
};

module.exports = {
  saveMessage,
  getMessages,
};
