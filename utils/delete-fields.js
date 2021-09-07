const Book = require('../models/bookModel');
require('../server')();


const addToGoodreadsUrlsArray = async () => {
  try {
    await Book.updateMany({},
      {
        $unset: {
          editionLanguage: 1,
        },
      },
    );
  } catch (error) {
    console.error(error);
  }
};
addToGoodreadsUrlsArray();
