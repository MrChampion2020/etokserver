const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.post('/facebooksignup', async (req, res) => {
  const { username, facebookId } = req.body;

  if (!username || !facebookId) {
    return res.status(400).json({ message: "Please provide username and Facebook ID" });
  }

  try {
    const existingUser = await User.findOne({ facebookId });
    if (existingUser) {
      return res.status(400).json({ message: "User with this Facebook ID already exists" });
    }

    const newUser = new User({ username, facebookId });
    await newUser.save();
    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
