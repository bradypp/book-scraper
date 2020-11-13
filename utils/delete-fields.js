const Book = require('../models/bookModel');
require('../server')();

// TODO
// Go through all books and add goodreadsUrl to goodreadsUrls array
// Find all duplicate isbns, in one doc add all duplicate urls to to goodreadsUrl array, save it, delete the rest
const addToGoodreadsUrlsArray = async () => {
  try {
    await Book.updateMany({},
      {
        $unset: {
          goodreadsUrl: 1,
        },
      },
    );
  } catch (error) {
    console.error(error);
  }
};
addToGoodreadsUrlsArray();
