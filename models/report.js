const mongoose = require('mongoose');
const Product = require('../models/product');
const User = require('../models/user');

const reportSchema = new mongoose.Schema({
   reference_id: {
      type: String,
   },
   type: {
      type: String,
   },
   username: {
      type: String,
   },
   message: {
      type: String,
      required: true,
   },
   reason: {
      type: String,
      required: true,
   },
   ban_requested: {
      type: Boolean,
   },
   ban_explanation: {
      type: String,
   },
   archived: {
      type: Boolean,
   },
});

reportSchema.methods.deleteReport = async function () {
   await this.delete();
};

module.exports = mongoose.model('Report', reportSchema);
