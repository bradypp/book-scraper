const Book = require('./models/bookModel');
require('./server')();

// TODO
// Go through all books and add goodreadsUrl to goodreadsUrls array
// Find all duplicate isbns, in one doc add all duplicate urls to to goodreadsUrl array, save it, delete the rest
const addToGoodreadsUrlsArray = async () => {
  try {
    const isbn = '9789966159892';
    let bookDoc = await Book.findOne({
      goodreadsUrls: 'https://www.goodreads.com/book/show/23286828-kintu-asdasd',
    });
    if (!bookDoc && isbn) {
      bookDoc = await Book.findOne({ isbn });
      console.log(isbn);
    }
    console.log(bookDoc);
  } catch (error) {
    console.error(error);
  }
};
addToGoodreadsUrlsArray();
