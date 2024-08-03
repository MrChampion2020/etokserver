const mongoose = require("mongoose");

const callSchema = new mongoose.Schema({
  caller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ["initiated", "accepted", "rejected", "ended"],
    default: "initiated",
  },
  type: {
    type: String,
    enum: ["audio", "video"],
    required: true,
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
  },
});

const Call = mongoose.model("Call", callSchema);

module.exports = Call;
