const express = require('express');
const router = express.Router();
const EmailSignup = require('../models/EmailSignup');

router.post('/emailSignup', async (req, res) => {
  const { email, password } = req.body;

  try {
    const existingUser = await EmailSignup.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    const newUser = new EmailSignup({ email, password });
    await newUser.save();
    res.status(201).json({ message: "Email user created successfully" });
  } catch (error) {
    console.error("Error creating email user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
