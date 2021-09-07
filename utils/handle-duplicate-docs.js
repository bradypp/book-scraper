const { set } = require('mongoose');
const Book = require('../models/bookModel');
require('../server')();

// Remove duplicate goodreadsIds
const removeDuplicateGoodreadsIds = async () => {
  try {
    let duplicateDocs = [];
    let prevGoodreadsId = '';
    const docs = await Book.find().select('_id isbn goodreadsUrl').sort('isbn');
    docs.forEach(doc => {
      if (doc.goodreadsId) {
        if (doc.goodreadsId === prevGoodreadsId) {
          duplicateDocs.push(doc);
        } else {
          const sortedDocs = duplicateDocs.sort((a, b) => {
            return b.goodreadsUrl.length - a.goodreadsUrl.length;
          });
          if (sortedDocs.length > 1) {
            const goodreadsUrls = [...new Set(...sortedDocs.map(el => el.goodreadsUrls))];
            // TODO Test before you enable this
            // sortedDocs.forEach(async (el, i, arr) => {
            //   if (i !== arr.length - 1) {
            //     await Book.deleteOne({ _id: el._id });
            //   }
            // });
            sortedDocs[sortedDocs.length - 1].goodreadsUrls = goodreadsUrls;
            sortedDocs[sortedDocs.length - 1].save();
            console.log({
              sortedDocs,
              goodreadsUrls,
              finalDoc: sortedDocs[sortedDocs.length - 1],
              goodreadsId: sortedDocs[sortedDocs.length - 1].goodreadsId,
            });
          }

          duplicateDocs = [doc];
          prevGoodreadsId = doc.goodreadsId;
        }
      }
    });
  } catch (error) {
    console.error(error);
  }
};

removeDuplicateGoodreadsIds();
