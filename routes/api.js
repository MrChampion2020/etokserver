const express = require('express');
const router = express.Router();
const Model = require('../models/User');

// Get all data
router.get('/data', async (req, res) => {
  try {
    const data = await Model.find();
    res.json(data);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Add new data
router.post('/data', async (req, res) => {
  try {
    const newData = new Model(req.body);
    await newData.save();
    res.json(newData);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Other CRUD routes (update, delete) as needed

module.exports = router;
