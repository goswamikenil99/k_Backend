import { Server as SocketIOServer } from "socket.io";
import Message from "./model/MessagesModel.js";
import Channel from "./model/ChannelModel.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import User from "./model/UserModel.js";
import dotenv from "dotenv";
dotenv.config();
const genAI = new GoogleGenerativeAI("AIzaSyCW8U9H4sHsPuP5fHtX90Em25o46q7N0_Q");

const setupSocket = (server) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: ["http://localhost:5173", "http://202.131.126.201:5173" ,  "https://guni-ai-fww8.onrender.com" ,"https://guni-ai.vercel.app",],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const userSocketMap = new Map();
  const AI_BOT_ID = "676ac2fe5b73f905030212a9";

  const addChannelNotify = async (channel) => {
    if (channel && channel.members) {
      channel.members.forEach((member) => {
        const memberSocketId = userSocketMap.get(member.toString());
        if (memberSocketId) {
          io.to(memberSocketId).emit("new-channel-added", channel);
        }
      });
    }
  };

  const sendMessage = async (message) => {
    const recipientSocketId = userSocketMap.get(message.recipient);
    const senderSocketId = userSocketMap.get(message.sender);
    // Create the message
    const createdMessage = await Message.create(message);
    const messageData = await Message.findById(createdMessage._id)
      .populate("sender", "id email firstName lastName image color")
      .populate("recipient", "id email firstName lastName image color")
      .exec();
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("receiveMessage", messageData);
    }
    if (senderSocketId) {
      io.to(senderSocketId).emit("receiveMessage", messageData);
    }
    if (!recipientSocketId && message.recipient != "676ac2fe5b73f905030212a9") {
      const user = await User.findOne({ _id: message.recipient });
      console.log(user);
      const userMessage = message.content;
      if (!userMessage) {
        return;
      }
      const status = {
        sender: message.recipient,
        recipient: message.sender,
        content: `Hello! It looks like ${user.firstName} ${user.lastName} isn’t available at the moment. I’ll let them know you reached out, or you can try again later.`,
        messageType: "text",
        timestamp: new Date(),
      };

      await sendMessage(status);
    }
  };

  const sendChannelMessage = async (message) => {
    const { channelId, sender, content, messageType, fileUrl } = message;
    const createdMessage = await Message.create({
      sender,
      recipient: null,
      content,
      messageType,
      timestamp: new Date(),
      fileUrl,
    });

    const messageData = await Message.findById(createdMessage._id)
      .populate("sender", "id email firstName lastName image color")
      .exec();

    await Channel.findByIdAndUpdate(channelId, {
      $push: { messages: createdMessage._id },
    });

    const channel = await Channel.findById(channelId).populate("members");
    const finalData = { ...messageData._doc, channelId: channel._id };
    if (channel && channel.members) {
      channel.members.forEach((member) => {
        const memberSocketId = userSocketMap.get(member._id.toString());
        if (memberSocketId) {
          io.to(memberSocketId).emit("recieve-channel-message", finalData);
        }
      });
      const adminSocketId = userSocketMap.get(channel.admin._id.toString());
      if (adminSocketId) {
        io.to(adminSocketId).emit("recieve-channel-message", finalData);
      }
    }
  };

  const handleAIResponse = async (message) => {
    console.log(
      "Received request to generate AI response for message:",
      message
    );
    var aiResponseContent;
    const userMessage = message.content;
    if (!userMessage) {
      return;
    }
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(userMessage);
      console.log(result.response.text());
      if (result) {
        aiResponseContent = result.response.text();
      } else {
        aiResponseContent = "Sorry, I didn’t understand that.";
      }
    } catch (error) {
      aiResponseContent = "Error communicating with Gemini API:";
    }
    const aiMessage = {
      sender: AI_BOT_ID,
      recipient: message.sender._id,
      content: aiResponseContent,
      messageType: "text",
      timestamp: new Date(),
    };

    await sendMessage(aiMessage);
    console.log("Sent AI response:", aiMessage);
  };

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    if (userId) {
      userSocketMap.set(userId, socket.id);
      console.log(`User connected: ${userId} with socket ID: ${socket.id}`);
    } else {
      console.log("User ID not provided during connection.");
    }

    socket.on("add-channel-notify", addChannelNotify);
    socket.on("sendMessage", sendMessage);
    socket.on("send-channel-message", sendChannelMessage);

    // Trigger AI response when message sent to AI bot
    socket.on("triggerAIResponse", handleAIResponse);

    socket.on("disconnect", () => {
      console.log("Client disconnected", socket.id);
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          break;
        }
      }
    });
  });
};

export default setupSocket;
