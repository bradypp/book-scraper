const { set } = require('mongoose');
const Book = require('../models/bookModel');
require('../server')();

const LanguageDetect = require('languagedetect');

// Remove duplicate goodreadsIds
const removeDuplicateGoodreadsIds = async () => {
  try {
    let page = 10680;
    let docsNumber = 10;
    while (docsNumber !== 0) {
      console.log('filter-tags: ' + page);
      const limit = 10;
      const skip = (page - 1) * limit;
      const docs = await Book.find().skip(skip).limit(limit);
      docsNumber = docs.length;
      for (const doc of docs) {
        const tags = doc.tags
          .filter(
            el =>
              el.search(
                /book|read|own|have|star|my|wishlist|wish-list|amazon|format|audio-wanted|default|humble-bundle|not-interested|returned|^favourite$|faves|children-s|<\/?[^>]+(>|$)|dnf|to-buy|\d{4}|tbr/,
              ) === -1,
          )
          .slice(0, 15);
        doc.tags = tags;
        doc.save();
      }
      page++;
    }
    console.log('done');
  } catch (error) {
    console.error(error);
  }
};

removeDuplicateGoodreadsIds();
