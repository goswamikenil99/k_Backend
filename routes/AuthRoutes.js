import { Router } from "express";
import {
  getUserInfo,
  login,
  signup,
  logout,
  updateProfile,
  addProfileImage,
  removeProfileImage,
  otp,
  sendotp,
  updatePassword,
} from "../controllers/AuthController.js";
import { verifyToken } from "../middlewares/AuthMiddleware.js";
import multer from "multer";

const authRoutes = Router();
const upload = multer({ dest: "uploads/profiles/" });

authRoutes.post("/signup", signup);
authRoutes.post("/sendotp", sendotp);
authRoutes.put("/updatepassword", updatePassword);
authRoutes.post("/login", login);
authRoutes.post("/logout", logout);
authRoutes.post("/otp", otp);
authRoutes.get("/userinfo", verifyToken, getUserInfo);
authRoutes.post("/update-profile", verifyToken, updateProfile);
authRoutes.post(
  "/add-profile-image",
  verifyToken,
  upload.single("profile-image"),
  addProfileImage
);
authRoutes.delete("/remove-profile-image", verifyToken, removeProfileImage);

export default authRoutes;
