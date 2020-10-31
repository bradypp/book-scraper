const { Schema, model } = require('mongoose');

const bookSchema = new Schema({
  goodreads_url: {
    type: String,
    trim: true,
  },
  title: {
    type: String,
    trim: true,
  },
  series_raw: {
    type: String,
    trim: true,
  },
  series: {
    type: String,
    trim: true,
  },
  series_with_number: {
    type: String,
    trim: true,
  },
  series_number: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  description_HTML: {
    type: String,
    trim: true,
  },
  description_HTML_short: {
    type: String,
    trim: true,
  },
  rating_value: {
    type: String,
    trim: true,
  },
  rating_count: {
    type: String,
    trim: true,
  },
  related_books_urls: {
    type: [String],
    trim: true,
  },
  related_books: {
    type: [Schema.Types.ObjectId],
    ref: 'Book'
  },
  authors: {
    type: [String],
    trim: true,
  },
  author: {
    type: String,
    trim: true,
  },
  cover_image: String,
  created_at: {
    type: Date,
    default: Date.now(),
  },
});

const bookModel = model('Book', bookSchema, 'books');

module.exports = bookModel;
