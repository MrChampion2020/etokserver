const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    default: function () {
      return this.name.toLowerCase().replace(/\s+/g, "");
    },
  },
  referralLink: { type: String, unique: true },
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  role: { type: String, enum: ['user', 'admin', 'vendor'], default: 'user' },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralLinkActive: { type: Boolean, default: true },
  accountType: { type: String, default: 'naira' },
  bankAccount: {
    accountNumber: String,
    bankName: String,
    accountHolderName: String,
  },
  age: {
    type: Number,
    required: true,
    default: 18,
  },
  wallet: {
    type: Number,
    default: 0
},
friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
 // Friend list
 
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    enum: ["male", "female", "other"],
  },
  verified: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,
  crushes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  recievedLikes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  matches: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  profileImages: [
    {
      type: String,
    },
  ],
  description: {
    type: String,
  },
  /*username: {type: String,

  },*/
  turnOns: [
    {
      type: String, //Array of string for turn ons
    },
  ],
  lookingFor: [
    {
      type: String, // Array of strings for what they are looking for
    },
  ],
  counrty: {
    type: String,
    default: "Nigeria",
  },
  diamond: {
    type: Number,
    default: 0,
  },
  walletHistory: {
    type: String,
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
  lastLogin: { type: Date, default: null },

  currentCall: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Call',
  }
}, { timestamps: true });


userSchema.pre('save', function(next) {
  if (!this.referralLink) {
    this.referralLink = `https://elitearn.com/register?ref=${this.username}`;
  }
  next();
});

const User = mongoose.model("User",userSchema);

module.exports = User