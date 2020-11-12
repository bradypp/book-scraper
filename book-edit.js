const Book = require('./models/bookModel');
require('./server')();

// Remove duplicate isbns
const removeDuplicateIsbns = async () => {
  try {
    let duplicateDocs = [];
    let prevIsbn = '';
    const docs = await Book.find().select('_id isbn goodreadsUrl').sort('isbn');
    docs.forEach(doc => {
      if (doc.isbn) {
        if (doc.isbn === prevIsbn) {
          duplicateDocs.push(doc);
        } else {
          const sortedDocs = duplicateDocs.sort((a, b) => {
            return b.goodreadsUrl.length - a.goodreadsUrl.length;
          });
          if (sortedDocs.length > 1) {
            sortedDocs.forEach(async (el, i, arr) => {
              if (i + 1 !== arr.length && el.goodreadsUrl.length > arr[i + 1].goodreadsUrl.length) {
                await Book.remove({ _id: el._id });
                // TODO: Add link to a blacklist database that's checked before being saved (use a middleware?) or just make link unavailable through a bool that's checked by book scraper 
                // await Link.remove({ link: el.goodreadsUrl })
              }
            });
          }

          duplicateDocs = [doc];
          prevIsbn = doc.isbn;
        }
      }
    });
  } catch (error) {
    console.error(error);
  }
};

removeDuplicateIsbns();
