const { Schema, model } = require('mongoose');

const linkSchema = new Schema({
  link: {
    type: String,
    required: true,
    unique: true
  },
  category: {
    type: String,
    trim: true,
    enum: ['book', 'author', 'genre', 'list', 'series'],
  },
  linksScrapedAt: {
    type: Date,
    default: Date.now(),
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

linkSchema.pre('save', function (next) {
  if (!this.category && this.isNew) {
    if (this.link.includes('book/show')) {
      this.category = 'book';
    }
    if (this.link.includes('author/show')) {
      this.category = 'author';
    }
    if (this.link.includes('genres')) {
      this.category = 'genre';
    }
    if (this.link.includes('list/show')) {
      this.category = 'list';
    }
    if (this.link.includes('series')) {
      this.category = 'series';
    }
  }
  next();
});

const Link = model('Link', linkSchema, 'links');

module.exports = Link;
