const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
require('dotenv').config();

const port = process.env.PORT || 3000;

const User = require("./models/User");
const Chat = require("./models/message");

// Middleware to parse JSON and URL-encoded data
app.use(express.json());
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.log("Error connecting to MongoDB:", error);
  });

// Generate a secret key for JWT
const generateSecretKey = () => crypto.randomBytes(32).toString("hex");
const secretKey = generateSecretKey();

// Send verification email function
const sendVerificationEmail = async (email, verificationToken) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  const API_URL = process.env.API_URL;
  const mailOptions = {
    from: "Etok.us",
    to: email,
    subject: "Email Verification",
    text: `Please click on the following link to verify your email: ${API_URL}/verify/${verificationToken}`,
    html: `<p style="background-color: purple; color: white; text-decoration: none; font-size: 20; margin: 20px auto; width: 70%; ">Please click on the following link to verify your email: <a href="${API_URL}/verify/${verificationToken}">${API_URL}/verify/${verificationToken}</a>VERIFY</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.log("Error sending the verification email:", error);
  }
};

// Registration endpoint
app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      verificationToken: crypto.randomBytes(20).toString("hex"),
    });

    await newUser.save();
    await sendVerificationEmail(newUser.email, newUser.verificationToken);

    res.status(200).json({ message: "User registered successfully", userId: newUser._id });
  } catch (error) {
    console.log("Error registering user:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});

// Email verification endpoint
app.get("/verify/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(404).json({ message: "Invalid verification token" });
    }

    user.verified = true;
    user.verificationToken = undefined;
    await user.save();

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.log("Error verifying email:", error);
    res.status(500).json({ message: "Email verification failed" });
  }
});

// Login endpoint
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, secretKey, { expiresIn: '1h' });
    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error });
  }
});

// Update user endpoints
app.put("/users/:userId/gender", async (req, res) => {
  try {
    const { userId } = req.params;
    const { gender } = req.body;

    const user = await User.findByIdAndUpdate(userId, { gender }, { new: true });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User gender updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error updating user gender", error });
  }
});

//updating user name
app.put("/users:userId/username", async (req, res) => {

  try{
    const { userId } =req.params;
    const { username } = req.body;

    const user = await User.findByIdAndUpdate(userId, { username }, { new: true } );

    if (!user){

      return res.status(404).json({message: "User not found"});
    }

    res.status(200).json({ message: "User name updated successfully" });
  }catch (error){
    res.status(500).json({ message: "user name update Failed", error});
  }
});

app.put("/users/:userId/description", async (req, res) => {
  try {
    const { userId } = req.params;
    const { description } = req.body;

    const user = await User.findByIdAndUpdate(userId, { description }, { new: true });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User description updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error updating user description", error });
  }
});

app.get("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: "Error fetching user details", error });
  }
});

// Add and remove turn-ons endpoints
app.put("/users/:userId/turn-ons/add", async (req, res) => {
  try {
    const { userId } = req.params;
    const { turnOn } = req.body;

    const user = await User.findByIdAndUpdate(userId, { $addToSet: { turnOns: turnOn } }, { new: true });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Turn on updated successfully", user });
  } catch (error) {
    res.status(500).json({ message: "Error adding the turn on", error });
  }
});

app.put("/users/:userId/turn-ons/remove", async (req, res) => {
  try {
    const { userId } = req.params;
    const { turnOn } = req.body;

    const user = await User.findByIdAndUpdate(userId, { $pull: { turnOns: turnOn } }, { new: true });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Turn on removed successfully", user });
  } catch (error) {
    res.status(500).json({ message: "Error removing turn on", error });
  }
});

// Add and remove looking-for endpoints
app.put("/users/:userId/looking-for", async (req, res) => {
  try {
    const { userId } = req.params;
    const { lookingFor } = req.body;

    const user = await User.findByIdAndUpdate(userId, { $addToSet: { lookingFor } }, { new: true });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Looking for updated successfully", user });
  } catch (error) {
    res.status(500).json({ message: "Error updating looking for", error });
  }
});

app.put("/users/:userId/looking-for/remove", async (req, res) => {
  try {
    const { userId } = req.params;
    const { lookingFor } = req.body;

    const user = await User.findByIdAndUpdate(userId, { $pull: { lookingFor } }, { new: true });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Looking for removed successfully", user });
  } catch (error) {
    res.status(500).json({ message: "Error removing looking for", error });
  }
});

// Chat and socket.io configuration
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("sendMessage", async (data) => {
    try {
      const { senderId, receiverId, message } = data;
      const newMessage = new Chat({ senderId, receiverId, message });
      await newMessage.save();

      io.to(receiverId).emit("receiveMessage", newMessage);
    } catch (error) {
      console.log("Error sending message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});

// Like and match endpoints
app.post("/like", async (req, res) => {
  try {
    const { userId, likedUserId } = req.body;

    const user = await User.findById(userId);
    const likedUser = await User.findById(likedUserId);

    if (!user || !likedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    user.likes.push(likedUserId);
    await user.save();

    if (likedUser.likes.includes(userId)) {
      user.matches.push(likedUserId);
      likedUser.matches.push(userId);
      await user.save();
      await likedUser.save();
    }

    res.status(200).json({ message: "Like recorded successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error recording like", error });
  }
});

// Listening to the server
http.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
