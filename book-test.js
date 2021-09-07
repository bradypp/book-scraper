const Book = require('./models/bookModel');
require('./server')();

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
