const { set } = require('mongoose');
const Book = require('../models/bookModel');
require('../server')();

const LanguageDetect = require('languagedetect');

// Remove duplicate goodreadsIds
const removeDuplicateGoodreadsIds = async () => {
  try {
    let page = 1;
    let docsNumber = 10;
    while (docsNumber !== 0) {
      console.log('language: ' + page);
      const limit = 10;
      const skip = (page - 1) * limit;
      const docs = await Book.find({ editionLanguage: { $exists: false } })
        .skip(skip)
        .limit(limit);
      docsNumber = docs.length;
      const languageDetector = new LanguageDetect();

      for (const doc of docs) {
        if (doc.descriptionHTML) {
          const languageArr = languageDetector.detect(
            doc.descriptionHTML.replace(/<\/?[^>]+(>|$)/g, ''),
            1,
          );

          
          const bookLanguage =
          languageArr.length > 0 && languageArr[0].length > 0 ? languageArr[0][0] : null;
          doc.editionLanguage =
          bookLanguage && bookLanguage !== 'pidgin'
          ? bookLanguage.toLowerCase().charAt(0).toUpperCase() +
          bookLanguage.toLowerCase().slice(1)
              : null;
          
          doc.save();
        }
      }
      page++;
    }
    console.log('done');
  } catch (error) {
    console.error(error);
  }
};

removeDuplicateGoodreadsIds();
