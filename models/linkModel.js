const { Schema, model } = require('mongoose');

const linkSchema = new Schema({
  link: {
    type: String,
    required: true,
    unique: true
  },
  linksScrapedAt: {
    type: Date,
    default: Date.now(),
  },
  bookId: {
    type: Schema.Types.ObjectId,
    ref: 'Book',
  },
  dataScrapedAt: {
    type: Date,
    default: Date.now(),
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

const Link = model('Link', linkSchema, 'links');

module.exports = Link;
