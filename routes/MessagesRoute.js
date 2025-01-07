import { Router } from "express";
import { ai_message, getMessages, uploadFile } from "../controllers/MessagesController.js";
import { verifyToken } from "../middlewares/AuthMiddleware.js";
import multer from "multer";

const messagesRoutes = Router();
const upload = multer({ dest: "uploads/files/" });
messagesRoutes.post("/get-messages", verifyToken, getMessages);
messagesRoutes.post("/ai_message",  ai_message);
messagesRoutes.post(
  "/upload-file",
  verifyToken,
  upload.single("file"),
  uploadFile
);

export default messagesRoutes;
