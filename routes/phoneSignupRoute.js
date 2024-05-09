const express = require('express');
const router = express.Router();
const User = require('./models/User');

router.post('/phonesignup', async (req, res) => {
  const { username, phone, password } = req.body;

  if (!username || !phone || !password) {
    return res.status(400).json({ message: "Please provide username, phone number, and password" });
  }

  try {
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ message: "User with this phone number already exists" });
    }

    const newUser = new User({ username, phone, password });
    await newUser.save();
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
