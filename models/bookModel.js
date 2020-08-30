const { Schema, model } = require('mongoose');

const bookSchema = new Schema({
    title: {
        type: String,
        trim: true,
    },
    series: {
        type: String,
        trim: true,
    },
    description: {
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
