import jwt from "jsonwebtoken";
import User from "../model/UserModel.js";
import { compare} from "bcrypt";
import bcrypt from "bcrypt";
import { renameSync, unlinkSync } from "fs";
import nodemailer from "nodemailer";
import mongoose from "mongoose";

// Function to generate a 4-digit OTP
const generateOtp = () => {
  return Math.floor(1000 + Math.random() * 9000); // Random 4-digit number
};

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail", // You can use other services like Outlook, Yahoo, etc.
  auth: {
    user: "kenilgoswami581@gmail.com", // Replace with your email
    pass: "zphlsrxchyltnend", // Replace with your email's app-specific password
  },
});

const maxAge = 3 * 24 * 60 * 60 * 1000;

const createToken = (email, userId) => {
  return jwt.sign({ email, userId }, process.env.JWT_KEY, {
    expiresIn: maxAge,
  });
};

export const updatePassword = async (request, response) => {
  try {
    const { email , password } = request.body;

    if (!email || !password) {
      return response.status(400).send("User email and Password is required.");
    }
    
    // Generate a salt
    const salt = await bcrypt.genSalt();

    // Hash the password with the generated salt
    const hashedPassword = await bcrypt.hash(password, salt);


    const result = await User.updateOne(
      { email: email }, // Find user by email
      { $set: { password: hashedPassword } } // Update the password field
    );
    return response.status(200).json({
      message : "Password Updated Successfully"
    });
  } catch (error) {
    console.log(error)
    return response.status(500).send("Internal Server Error.");
  }
};

export const sendotp = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate that email exists
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    //User Existance
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({ message: 'User not found Please Sign-Up' });
    }

    // Generate a 4-digit OTP
    const otp = generateOtp();

    // Send email with nodemailer
    const mailOptions = {
      from: "kenilgoswami21@gmail.com", // Sender address
      to: email, // Receiver email address
      subject: "Your OTP Code",
      text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
    };

    // Send the email
    await transporter.sendMail(mailOptions);

    console.log(`OTP sent to ${email}: ${otp}`); // Log the OTP on the server (for testing)

    // Respond with success
    res.status(200).json({ otp : otp});
  } catch (error) {
    console.error("Error sending OTP:", error);
    res
      .status(500)
      .json({ message: "Failed to send OTP", error: error.message });
  }
};

export const signup = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(404).send("User already exists. Please log in.");
    }

    // Validate email and password
    if (!email || !password || !role) {
      return res.status(400).send("some credentials are Missing.");
    }

    // Create new user with the determined role
    const newUser = await User.create({ email, password, role });

    // Set JWT cookie
    res.cookie("jwt", createToken(email, newUser.id), {
      maxAge,
      secure: true,
      sameSite: "None",
    });

    // Respond with user details
    return res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        profileSetup: newUser.profileSetup,
      },
    });
  } catch (err) {
    console.error("Signup Error:", err);
    return res.status(500).send("Internal Server Error");
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (email && password) {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).send("User not found");
      }
      const auth = await compare(password, user.password);
      if (!auth) {
        return res.status(400).send("Invalid Password");
      }
      res.cookie("jwt", createToken(email, user.id), {
        maxAge,
        secure: true,
        sameSite: "None",
      });
      return res.status(200).json({
        user: {
          id: user?.id,
          email: user?.email,
          firstName: user.firstName,
          lastName: user.lastName,
          image: user.image,
          profileSetup: user.profileSetup,
          role: user?.role,
        },
      });
    } else {
      return res.status(400).send("Email and Password Required");
    }
  } catch (err) {
    return res.status(500).send("Internal Server Error");
  }
};

export const getUserInfo = async (request, response, next) => {
  try {
    if (request.userId) {
      const userData = await User.findById(request.userId);
      if (userData) {
        return response.status(200).json({
          id: userData?.id,
          email: userData?.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          image: userData.image,
          profileSetup: userData.profileSetup,
          color: userData.color,
        });
      } else {
        return response.status(404).send("User with the given id not found.");
      }
    } else {
      return response.status(404).send("User id not found.");
    }
  } catch (error) {
    console.log({ error });
    return response.status(500).send("Internal Server Error");
  }
};

export const logout = async (request, response, next) => {
  try {
    response.cookie("jwt", "", { maxAge: 1, secure: true, sameSite: "None" });
    return response.status(200).send("Logout successful");
  } catch (err) {
    return response.status(500).send("Internal Server Error");
  }
};

export const updateProfile = async (request, response, next) => {
  try {
    const { userId } = request;

    const { firstName, lastName, color } = request.body;

    if (!userId) {
      return response.status(400).send("User ID is required.");
    }

    if (!firstName || !lastName) {
      return response.status(400).send("Firstname and Last name is required.");
    }

    const userData = await User.findByIdAndUpdate(
      userId,
      {
        firstName,
        lastName,
        color,
        profileSetup: true,
      },
      {
        new: true,
        runValidators: true,
      }
    );
    return response.status(200).json({
      id: userData.id,
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      image: userData.image,
      profileSetup: userData.profileSetup,
      color: userData.color,
    });
  } catch (error) {
    return response.status(500).send("Internal Server Error.");
  }
};

export const addProfileImage = async (request, response, next) => {
  try {
    if (request.file) {
      const date = Date.now();
      let fileName = "uploads/profiles/" + date + request.file.originalname;
      renameSync(request.file.path, fileName);
      const updatedUser = await User.findByIdAndUpdate(
        request.userId,
        { image: fileName },
        {
          new: true,
          runValidators: true,
        }
      );
      return response.status(200).json({ image: updatedUser.image });
    } else {
      return response.status(404).send("File is required.");
    }
  } catch (error) {
    console.log({ error });
    return response.status(500).send("Internal Server Error.");
  }
};

export const removeProfileImage = async (request, response, next) => {
  try {
    const { userId } = request;

    if (!userId) {
      return response.status(400).send("User ID is required.");
    }

    const user = await User.findById(userId);

    if (!user) {
      return response.status(404).send("User not found.");
    }

    if (user.image) {
      unlinkSync(user.image);
    }

    user.image = null;
    await user.save();

    return response
      .status(200)
      .json({ message: "Profile image removed successfully." });
  } catch (error) {
    console.log({ error });
    return response.status(500).send("Internal Server Error.");
  }
};

export const otp = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const otp = generateOtp();

  // Set up Nodemailer transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "kenilgoswami581@gmail.com",
      pass: "grjl sodp kppm qyeb",
    },
  });

  const mailOptions = {
    from: "kenilgoswami581@gmail.com",
    to: email,
    subject: "Smart Talk",
    text: `Your OTP code is :- ${otp}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "OTP sent successfully", otp: otp }); // You may want to store the OTP for verification later
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to send OTP" });
  }
};
