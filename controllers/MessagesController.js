import Message from "../model/MessagesModel.js";
import { mkdirSync, renameSync } from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI("AIzaSyCW8U9H4sHsPuP5fHtX90Em25o46q7N0_Q");

// Function to handle fetching messages between two users
export const getMessages = async (req, res, next) => {
  try {
    const user1 = req.userId;
    const user2 = req.body.id;
    if (!user1 || !user2) {
      return res.status(400).send("Both user IDs are required.");
    }

    const messages = await Message.find({
      $or: [
        { sender: user1, recipient: user2 },
        { sender: user2, recipient: user1 },
      ],
    }).sort({ timestamp: 1 });

    return res.status(200).json({ messages });
  } catch (err) {
    console.log(err);
    return res.status(500).send("Internal Server Error");
  }
};

// AI message handling function
export const ai_message = async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    return res.status(400).json({ error: "Message is required." });
  }
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(userMessage);
    console.log(result.response.text());
    // Send the response from Gemini back to the user
    return res.json({
      reply: result || "Sorry, I didn’t understand that.",
    });
  } catch (error) {
    console.error("Error communicating with Gemini API:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// File upload endpoint with directory creation
export const uploadFile = async (request, response, next) => {
  try {
    if (request.file) {
      console.log("File received. Processing...");
      const date = Date.now();
      let fileDir = `uploads/files/${date}`;
      let fileName = `${fileDir}/${request.file.originalname}`;

      // Create directory if it doesn't exist
      mkdirSync(fileDir, { recursive: true });

      // Rename/move the file to the new directory
      renameSync(request.file.path, fileName);
      return response.status(200).json({ filePath: fileName });
    } else {
      return response.status(404).send("File is required.");
    }
  } catch (error) {
    console.log({ error });
    return response.status(500).send("Internal Server Error.");
  }
};
