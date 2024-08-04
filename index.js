const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const crypto = require("crypto");
const path = require('path');
const multer = require('multer');
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
const Call = require("./models/Call");
const CallRecord = require('./models/CallRecord');

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

// Fetch the JWT secret key from environment variables
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

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

  socket.on("userOnline", async (userId) => {
    await User.findByIdAndUpdate(userId, { isOnline: true });
    socket.join(userId);
    console.log(`User ${userId} is online`);
  });

  socket.on("userOffline", async (userId) => {
    await User.findByIdAndUpdate(userId, { isOnline: false });
    socket.leave(userId);
    console.log(`User ${userId} is offline`);
  });

  socket.on("initiateCall", async (data) => {
    const { callerId, receiverId, type } = data;

    const call = new Call({ caller: callerId, receiver: receiverId, type });
    await call.save();

    io.to(receiverId).emit("incomingCall", { callId: call._id, callerId, type });
    console.log(`Call initiated from ${callerId} to ${receiverId}`);
  });

  socket.on("acceptCall", async (data) => {
    const { callId } = data;
    const call = await Call.findById(callId);

    if (call) {
      call.status = "accepted";
      await call.save();

      io.to(call.caller).emit("callAccepted", { callId });
      io.to(call.receiver).emit("startCall", { callId });
      console.log(`Call ${callId} accepted`);
    }
  });

  socket.on("rejectCall", async (data) => {
    const { callId } = data;
    const call = await Call.findById(callId);

    if (call) {
      call.status = "rejected";
      await call.save();

      io.to(call.caller).emit("callRejected", { callId });
      console.log(`Call ${callId} rejected`);
    }
  });

  socket.on("endCall", async (data) => {
    const { callId } = data;
    const call = await Call.findById(callId);

    if (call) {
      call.status = "ended";
      call.endTime = Date.now();
      await call.save();

      io.to(call.caller).emit("callEnded", { callId });
      io.to(call.receiver).emit("callEnded", { callId });
      console.log(`Call ${callId} ended`);
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
});




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
    html: `<p style="background-color: white; color: purple; text-decoration: none; font-size: 20; margin: 20px auto; width: 70%; ">Please click on the following link to verify your email: <a href="${API_URL}/verify/${verificationToken}">${API_URL}/verify/${verificationToken}</a>VERIFY</p>`,
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



/*
app.post("/register", async (req, res) => {
  try {
    const { fullName, email, phone, password, username, referralLink, couponCode, accountType = 'naira' } = req.body;

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const coupon = await Coupon.findOne({ code: couponCode });
    if (!coupon || !coupon.isActive || coupon.isUsed) {
      return res.status(400).json({ message: "Invalid or inactive coupon code" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      fullName,
      email,
      phone,
      password: hashedPassword,
      username,
      verificationToken: crypto.randomBytes(20).toString("hex"),
      accountType
    });

    // Generate referral link
    newUser.referralLink = `${process.env.API_URL}/register?ref=${username}`;

    if (referralLink) {
      const referrer = await User.findOne({ username: referralLink }) || await Vendor.findOne({ username: referralLink });
      if (referrer && referrer.referralLinkActive) {
        newUser.referredBy = referrer._id;
        referrer.referrals.push(newUser._id);

        // Credit referrer's wallet
        const amountToCredit = referrer.accountType === 'naira' ? 4000 : 4;
        referrer.wallet += amountToCredit;
        await referrer.save();
      } else {
        return res.status(400).json({ message: "Invalid or inactive referral link" });
      }
    }

    await newUser.save();
    await sendVerificationEmail(newUser.email, newUser.verificationToken);

    // Mark coupon as used
    coupon.isUsed = true;
    coupon.isActive = false;
    coupon.usedBy = { email: newUser.email, username: newUser.username, phone: newUser.phone };
    await coupon.save();

    // Distribute referral bonuses
    await distributeReferralBonusUser(newUser._id, 3, 3); // Assuming 3 levels of referral bonus for both user and vendor

    res.status(200).json({ message: "User registered successfully", userId: newUser._id });
  } catch (error) {
    console.log("Error registering user:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Duplicate key error", error: error.message });
    }
    res.status(500).json({ message: "Registration failed" });
  }
});
*/ 

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


/*
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const now = new Date();
    const lastLogin = user.lastLogin || new Date(0);
    const oneDayInMilliseconds = 24 * 60 * 60 * 1000;

    if (now - lastLogin >= oneDayInMilliseconds) {
      user.referralWallet += 250;
      user.lastLogin = now;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, secretKey, { expiresIn: '1h' });

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.log("Error logging in user:", error);
    res.status(500).json({ message: "Login failed" });
  }
});
*/

//user auth
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, secretKey, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

app.get("/user-details", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      user: {
        username: user.username,
        friends: user.friends,
        wallet: user.wallet,
        diamond: user.diamond,
        referralWallet: user.referralWallet,
        referrals: user.referrals,
        referralLink: user.referralLink,
        bankAccount: user.bankAccount,
        verified: user.verified,
        gender: user.gender,
        crushes: user.crushes,
        receivedLikes: user.receivedLikes,
        matches: user.matches,
        profileImages: user.profileImages,
        description: user.description,
        turnOns: user.turnOns,
        lookingFor: user.lookingFor,
        isOnline: user.isOnline,
        currentCall: user.currentCall,
        callHistory: user.callHistory,
        walletHistory: user.walletHistory,
        country: user.country,
      }
    });
  } catch (error) {
    console.log("Error fetching user details:", error);
    res.status(500).json({ message: "Error fetching user details", error });
  }
});


// Configure Multer for File Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'assets/uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Appending extension
  }
});

const upload = multer({ storage: storage });

// Serve static files
app.use('/assets/uploads', express.static(path.join(__dirname, 'assets/uploads')));

// Upload Profile Image
app.put('/users/:userId/profile-image', upload.single('image'), async (req, res) => {
  try {
    const userId = req.params.userId;
    const profileImagePath = `/assets/uploads/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(userId, { profileImage: profileImagePath }, { new: true });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile image updated successfully', user });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Fetch User Details
app.get('/users/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

/*
app.get("/user-details", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      user: {
        fullName: user.fullName,
        email: user.email,
        username: user.username,
        phone: user.phone,
        wallet: user.wallet,
        referralWallet: user.referralWallet,
        eliteWallet: user.eliteWallet,
        referrals: user.referrals,
        referralLink: user.referralLink,
      }
    });
  } catch (error) {
    console.log("Error fetching user details:", error);
    res.status(500).json({ message: "Error fetching user details", error });
  }
});
*/

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


//fetch users data
app.get("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(500).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: "Error fetching the user details" });
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

// Add coin recharge endpoint
app.post("/recharge", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.wallet += amount;
    await user.save();

    res.status(200).json({ message: "Coins recharged successfully", wallet: user.wallet });
  } catch (error) {
    console.log("Error recharging coins:", error);
    res.status(500).json({ message: "Recharge failed" });
  }
});

app.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile picture
app.put("/users/:userId/profilePicture", async (req, res) => {
  try {
    const { userId } = req.params;
    const { profilePicture } = req.body;

    const user = await User.findByIdAndUpdate(userId, { profilePicture }, { new: true });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User profile picture updated successfully", user });
  } catch (error) {
    console.log("Error updating user profile picture:", error);
    res.status(500).json({ message: "Error updating user profile picture", error });
  }
});

// Call routes
app.post('/calls', async (req, res) => {
  const { callerId, receiverId, type, status, startTime, endTime } = req.body;
  try {
    const callRecord = new CallRecord({ caller: callerId, receiver: receiverId, type, status, startTime, endTime });
    await callRecord.save();
    res.status(201).json(callRecord);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/calls/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const callRecords = await CallRecord.find({
      $or: [{ caller: userId }, { receiver: userId }]
    }).populate('caller receiver');
    res.json(callRecords);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



//endpoint to fetch all the profiles for a particular user
app.get("/profiles", async (req, res) => {
  const { userId, gender, turnOns, lookingFor } = req.query;

  try {
    let filter = { gender: gender === "male" ? "female" : "male" }; // For gender filtering

    // Add filtering based on turnOns and lookingFor arrays
    if (turnOns) {
      filter.turnOns = { $in: turnOns };
    }

    if (lookingFor) {
      filter.lookingFor = { $in: lookingFor };
    }

    const currentUser = await User.findById(userId)
      .populate("matches", "_id")
      .populate("crushes", "_id");

    // Extract IDs of friends
    const friendIds = currentUser.matches.map((friend) => friend._id);

    // Extract IDs of crushes
    const crushIds = currentUser.crushes.map((crush) => crush._id);

    const profiles = await User.find(filter)
      .where("_id")
      .nin([userId, ...friendIds, ...crushIds]);

    return res.status(200).json({ profiles });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching profiles", error });
  }
});

app.post("/send-like", async (req, res) => {
  const { currentUserId, selectedUserId } = req.body;

  try {
    //update the recepient's friendRequestsArray!
    await User.findByIdAndUpdate(selectedUserId, {
      $push: { recievedLikes: currentUserId },
    });
    //update the sender's sentFriendRequests array
    await User.findByIdAndUpdate(currentUserId, {
      $push: { crushes: selectedUserId },
    });

    res.sendStatus(200);
  } catch (error) {
    res.sendStatus(500);
  }
});

//ednpoint to get the details of the received Likes
app.get("/received-likes/:userId/details", async (req, res) => {
  const { userId } = req.params;

  try {
    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Fetch details of users who liked the current user
    const receivedLikesDetails = [];
    for (const likedUserId of user.recievedLikes) {
      const likedUser = await User.findById(likedUserId);
      if (likedUser) {
        receivedLikesDetails.push(likedUser);
      }
    }

    res.status(200).json({ receivedLikesDetails });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching received likes details",
      error: error.message,
    });
  }
});

//endpoint to create a match betweeen two people
app.post("/create-match", async (req, res) => {
  try {
    const { currentUserId, selectedUserId } = req.body;

    //update the selected user's crushes array and the matches array
    await User.findByIdAndUpdate(selectedUserId, {
      $push: { matches: currentUserId },
      $pull: { crushes: currentUserId },
    });

    //update the current user's matches array recievedlikes array
    await User.findByIdAndUpdate(currentUserId, {
      $push: { matches: selectedUserId },
      $pull: { recievedLikes: selectedUserId },
    });

    res.sendStatus(200);
  } catch (error) {
    res.status(500).json({ message: "Error creating a match", error });
  }
});

//endpoint to get all the matches of the particular user
app.get("/users/:userId/matches", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const matchIds = user.matches;

    const matches = await User.find({ _id: { $in: matchIds } });

    res.status(200).json({ matches });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving the matches", error });
  }
});



io.on("connection", (socket) => {
  console.log("a user is connected");

  socket.on("sendMessage", async (data) => {
    try {
      const { senderId, receiverId, message } = data;

      console.log("data", data);

      const newMessage = new Chat({ senderId, receiverId, message });
      await newMessage.save();

      //emit the message to the receiver
      io.to(receiverId).emit("receiveMessage", newMessage);
    } catch (error) {
      console.log("Error handling the messages");
    }
    socket.on("disconnet", () => {
      console.log("user disconnected");
    });
  });
});

io.on("connection", (socket) => {
  console.log("a user is connected");

  socket.on("sendMessage", async (data) => {
    try {
      const { senderId, receiverId, message } = data;

      console.log("data", data);

      const newMessage = new Chat({ senderId, receiverId, message });
      await newMessage.save();

      //emit the message to the receiver
      io.to(receiverId).emit("receiveMessage", newMessage);
    } catch (error) {
      console.log("Error handling the messages");
    }
    socket.on("disconnet", () => {
      console.log("user disconnected");
    });
  });
});

/*
http.listen(8000, () => {
  console.log("Socket.IO server running on port 8000");
});
*/
app.get("/messages", async (req, res) => {
  try {
    const { senderId, receiverId } = req.query;

    console.log(senderId);
    console.log(receiverId);

    const messages = await Chat.find({
      $or: [
        { senderId: senderId, receiverId: receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    }).populate("senderId", "_id name");

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ message: "Error in getting messages", error });
  }
});


//endpoint to delete the messages;

app.post("/delete",async(req,res) => {
    try{
        const {messages} = req.body;

        if(!Array.isArray(messages) || messages.length == 0){
            return res.status(400).json({message:"Invalid request body"})
        };

        for(const messageId of messages){
            await Chat.findByIdAndDelete(messageId);
        }

        res.status(200).json({message:"Messages delted successfully!"})
    } catch(error){
        res.status(500).json({message:"Internal server error",error})
    }
})
// Listening to the server
http.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
