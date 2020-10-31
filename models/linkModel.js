const { Schema, model } = require('mongoose');

const linkSchema = new Schema({
  links_source: {
    type: String,
    required: true,
    unique: true,
  },
  links: {
    type: [String],
    required: true,
  },
  updated_at: {
    type: Date,
    default: Date.now(),
  },
  created_at: {
    type: Date,
    default: Date.now(),
  },
});

const linkModel = model('Link', linkSchema, 'links');

module.exports = linkModel;
