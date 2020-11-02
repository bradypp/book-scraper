const puppeteer = require('puppeteer');
const moment = require('moment');

require('../server')();

// Have an array or goodreads urls to make looking all of them up possible
// Or scrape related books & series books saving id in the array for future lookup
// If book doc already exists, save the most recent latest publication
const selectors = require('../utils/selectors');
const imageUpload = require('../utils/imageUpload');
const scraperConfig = require('../config/scraper');
const Book = require('../models/bookModel');
const Link = require('../models/linkModel');

const shuffle = array => {
  var currentIndex = array.length,
    temporaryValue,
    randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
};

const bookScraper = async () => {
  try {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);

    const goodreadsUrl = 'https://www.goodreads.com/user/sign_in';
    await page.goto(goodreadsUrl, scraperConfig.pageLoadOptions);
    await page.$eval(selectors.emailInput, el => (el.value = 'bookrecommender@hotmail.co.uk'));
    await page.$eval(selectors.passwordInput, el => (el.value = '575857585758'));
    await page.evaluate(selectors => {
      document.querySelector(selectors.signInForm).submit();
    }, selectors);

    // Wait for sign in to finish by waiting for personal nav
    await page.waitForSelector('.personalNav', { visible: false, timeout: 0 });

    while (true) {
      const limit = Math.floor(Math.random() * (500 + 2000));
      const dbLinks = await Link.find({ category: 'book' })
        .sort('dataScrapedAt')
        .select('link')
        .limit(limit);
      const bookLinks = shuffle([...new Set(dbLinks.map(el => el.link))]);

      for (let i = 0; i < bookLinks.length; i++) {
        try {
          if (!bookLinks[i].includes('book/show')) continue;

          // Go to each book page
          await page.goto(bookLinks[i], scraperConfig.pageLoadOptions);

          const title = await page.$eval('#bookTitle', el => el.innerText.trim());

          const bookDoc = await Book.findOne({ title });
          const bookUrl = await page.evaluate(() => {
            return location ? `${location.protocol}//${location.host}${location.pathname}` : null;
          });

          // Only scrape unique books (comment out to scrape all books)
          if (bookDoc) {
            bookDoc.goodreadsUrls = [...new Set([...bookDoc.goodreadsUrls, bookUrl])];
            bookDoc.updatedAt = Date.now();
            bookDoc.save();
            try {
              await Link.findOneAndUpdate({ link: bookLinks[i] }, { dataScrapedAt: Date.now() });
            } catch (error) {
              console.error(error);
            }
            console.log('scraped');
            continue;
          }

          // Get book data
          const scrapedData = await page.evaluate(
            args => {
              const { selectors } = args;

              const bookElements = {};
              selectors.forEach(el => {
                if (el.isXPathSelector) {
                  bookElements[el.name] = getElementFromXPath(el.selector);
                } else {
                  bookElements[el.name] = el.isIteratable
                    ? document.querySelectorAll(el.selector)
                    : document.querySelector(el.selector);
                }
              });

              const latestMatch = bookElements.details
                ? bookElements.details.innerText.match(/Published (.{0,18}\d{4})/)
                : null;
              const latestPublishedString = latestMatch ? latestMatch[1] : null;

              const firstMatch = bookElements.details
                ? bookElements.details.innerText.match(/first published (.+)[)]/)
                : null;
              const firstPublishedString = firstMatch ? firstMatch[1] : null;

              let ratingValue = null;
              if (
                bookElements.ratingValue &&
                typeof Number(bookElements.ratingValue.innerText) === 'number'
              ) {
                ratingValue = Number(bookElements.ratingValue.innerText);
              }

              let ratingCount = null;
              if (
                bookElements.ratingCount &&
                typeof Number(bookElements.ratingCount.content) === 'number'
              ) {
                ratingCount = Number(bookElements.ratingCount.content);
              }

              let reviewCount = null;
              if (
                bookElements.reviewCount &&
                typeof Number(bookElements.reviewCount.content) === 'number'
              ) {
                reviewCount = Number(bookElements.reviewCount.content);
              }

              let isbn13 = null;
              if (
                bookElements.isbn13 &&
                bookElements.isbn13.content !== 'null' &&
                typeof Number(bookElements.isbn13.content) === 'number'
              ) {
                isbn13 = Number(bookElements.reviewCount.content);
              }

              let numberOfPages = null;
              const numberOfPagesMatch = bookElements.numberOfPages
                ? bookElements.numberOfPages.innerText.match(/\d+/)
                : null;
              if (numberOfPagesMatch && typeof Number(numberOfPagesMatch[0]) === 'number') {
                numberOfPages = Number(numberOfPagesMatch[0]);
              }

              return {
                coverImageUrl: bookElements.coverImage ? bookElements.coverImage.src : null,
                title: bookElements.title ? bookElements.title.innerText : null,
                seriesRaw: bookElements.series ? bookElements.series.innerText : null,
                seriesLink: bookElements.series ? bookElements.series.href : null,
                authors:
                  bookElements.authors && bookElements.authors.length !== 0
                    ? Array.from(bookElements.authors).map(el => el.innerText.trim())
                    : [],
                description:
                  bookElements.description && bookElements.description.length !== 0
                    ? Array.from(bookElements.description).reduce((acc, el) => {
                        if (el.innerText && el.innerText.length > acc.length) return el.innerText;
                        return acc;
                      }, '')
                    : null,
                descriptionHTML:
                  bookElements.description && bookElements.description.length !== 0
                    ? Array.from(bookElements.description).reduce((acc, el) => {
                        if (el.innerText && el.innerText.length > acc.length) return el.innerHTML;
                        return acc;
                      }, '')
                    : null,
                descriptionHTMLShort:
                  bookElements.description && bookElements.description.length !== 0
                    ? Array.from(bookElements.description).reduce((acc, el) => {
                        if (acc.length === 0) return el.innerHTML;
                        if (el.innerText && el.innerText.length < acc.length) return el.innerHTML;
                        return acc;
                      }, '')
                    : null,
                ratingValue,
                ratingCount,
                reviewCount,
                isbn13,
                numberOfPages,
                relatedBooksUrls:
                  bookElements.relatedBooks && bookElements.relatedBooks.length !== 0
                    ? Array.from(bookElements.relatedBooks).map(link => link.href)
                    : [],
                bookEdition: bookElements.bookEdition ? bookElements.bookEdition.innerText : null,
                bookFormat: bookElements.bookFormat ? bookElements.bookFormat.innerText : null,
                latestPublishedString,
                firstPublishedString,
                genres:
                  bookElements.genres && bookElements.genres.length !== 0
                    ? [
                        ...new Set(
                          Array.from(bookElements.genres).map(el => el.innerText.toLowerCase()),
                        ),
                      ]
                    : [],
                tagsLink: bookElements.tagsLink ? bookElements.tagsLink.href : null,
              };
            },
            { selectors: selectors.bookPage },
          );

          const {
            seriesLink,
            tagsLink,
            coverImageUrl,
            latestPublishedString,
            firstPublishedString,
            ...bookData
          } = scrapedData;
          console.log('made it here');
          let tags = [];
          if (tagsLink && typeof tagsLink === 'string') {
            try {
              await page.goto(tagsLink, scraperConfig.pageLoadOptions);
              tags = await page.evaluate(
                args => {
                  const { selector } = args;
                  const tagElements = document.querySelectorAll('.mainContent .leftContainer a');
                  return Array.from(tagElements)
                    .filter(
                      el =>
                        el.href.includes('genres') &&
                        el.innerText.search(/book|read|own|have|star|my|\d{4}|tbr/) === -1,
                    )
                    .map(el => el.innerText)
                    .slice(0, 20);
                },
                { selector: selectors.tags },
              );
            } catch (error) {
              console.error(error);
            }
          }

          let series = null;
          let seriesNumber = null;
          let booksInSeries = [];
          if (seriesLink && typeof seriesLink === 'string') {
            try {
              await page.goto(seriesLink, scraperConfig.pageLoadOptions);
              const seriesData = await page.evaluate(
                args => {
                  let seriesNumber;
                  const { title } = args;
                  const bookElements = document.querySelectorAll('.listWithDividers__item');
                  const booksInSeries = Array.from(bookElements).map(el => {
                    const h3Tags = el.getElementsByTagName('h3');
                    const bookNumberText =
                      h3Tags && h3Tags.length !== 0 ? h3Tags[0].innerText : null;
                    const bookNumberMatch = bookNumberText.match(/\d+/);
                    const bookNumber = bookNumberMatch ? bookNumberMatch[0] : null;

                    const aTags = el.getElementsByTagName('a');
                    const bookLink = aTags && aTags.length !== 0 ? aTags[0].href : null;
                    const bookTitle = aTags && aTags.length !== 0 ? aTags[1].innerText : null;

                    if (bookTitle.trim().toLowerCase() === title.toLowerCase()) {
                      seriesNumber = bookNumber;
                    }
                    return {
                      goodreadsUrl: bookLink,
                      seriesNumber: bookNumber,
                      title: bookTitle,
                    };
                  });
                  const series = document.querySelector('h1').innerText.split(' Series')[0];
                  return {
                    booksInSeries,
                    series,
                    seriesNumber,
                  };
                },
                {
                  title,
                },
              );
              series = seriesData.series;
              booksInSeries = seriesData.booksInSeries;
              seriesNumber = seriesData.seriesNumber;
            } catch (error) {
              console.error(error);
            }
          }

          const dayRegex = new RegExp(['st', 'nd', 'rd', 'th'].join('|'));

          const monthRegex = new RegExp(
            [
              'January',
              'February',
              'March',
              'April',
              'May',
              'June',
              'July',
              'August',
              'September',
              'October',
              'November',
              'December',
            ].join('|'),
          );
          const yearRegex = new RegExp(/\d{4}/);

          const latestContainsDay = dayRegex.test(latestPublishedString);
          const latestContainsMonth = monthRegex.test(latestPublishedString);
          const latestContainsYear = yearRegex.test(latestPublishedString);

          let latestPublishedFormat = null;
          if (latestContainsDay && latestContainsMonth && latestContainsYear) {
            latestPublishedFormat = 'MMMM Do YYYY';
          } else if (latestContainsDay && latestContainsMonth && !latestContainsYear) {
            latestPublishedFormat = 'MMMM Do';
          } else if (!latestContainsDay && latestContainsMonth && latestContainsYear) {
            latestPublishedFormat = 'MMMM YYYY';
          } else if (!latestContainsDay && !latestContainsMonth && latestContainsYear) {
            latestPublishedFormat = 'YYYY';
          } else if (latestContainsDay && !latestContainsMonth && latestContainsYear) {
            latestPublishedFormat = 'Do YYYY';
          }

          const firstContainsDay = dayRegex.test(firstPublishedString);
          const firstContainsMonth = monthRegex.test(firstPublishedString);
          const firstContainsYear = yearRegex.test(firstPublishedString);

          let firstPublishedFormat = null;
          if (firstContainsDay && firstContainsMonth && firstContainsYear) {
            firstPublishedFormat = 'MMMM Do YYYY';
          } else if (firstContainsDay && firstContainsMonth && !firstContainsYear) {
            firstPublishedFormat = 'MMMM Do';
          } else if (!firstContainsDay && firstContainsMonth && firstContainsYear) {
            firstPublishedFormat = 'MMMM YYYY';
          } else if (!firstContainsDay && !firstContainsMonth && firstContainsYear) {
            firstPublishedFormat = 'YYYY';
          } else if (firstContainsDay && !firstContainsMonth && firstContainsYear) {
            firstPublishedFormat = 'Do YYYY';
          }

          const latestPublished = moment(latestPublishedString, latestPublishedFormat)
            .utc()
            .format();
          const firstPublished = moment(firstPublishedString, firstPublishedFormat).utc().format();

          if (!bookDoc) {
            try {
              const doc = await Book.create({
                ...bookData,
                goodreadsUrls: [bookUrl],
                latestGoodreadsUrl: bookUrl,
                title,
                latestPublished: latestPublished !== 'Invalid date' ? latestPublished : null,
                latestPublishedFormat:
                  latestPublished !== 'Invalid date' && latestPublishedFormat
                    ? latestPublishedFormat
                    : null,
                firstPublished: firstPublished !== 'Invalid date' ? firstPublished : null,
                firstPublishedFormat:
                  firstPublished !== 'Invalid date' && firstPublishedFormat
                    ? firstPublishedFormat
                    : null,
                tags,
                coverImage: coverImageUrl ? await imageUpload(coverImageUrl) : null,
                series,
                seriesNumber,
                booksInSeries,
                updatedAt: Date.now(),
              });
              console.log(doc);
            } catch (error) {
              console.error(error);
            }
          } else {
            try {
              const isBookDataLatest =
                latestPublished &&
                latestPublished !== 'Invalid Date' &&
                bookDoc.latestPublished <= new Date(latestPublished);
              bookDoc.goodreadsUrls = [...new Set([...bookDoc.goodreadsUrls, bookUrl])];
              bookDoc.relatedBooksUrls = [
                ...new Set([...bookData.relatedBooksUrls, ...bookDoc.relatedBooksUrls]),
              ];
              bookDoc.firstPublished =
                bookDoc.firstPublished || (firstPublished && firstPublished !== 'Invalid Date')
                  ? firstPublished
                  : null;
              bookDoc.firstPublishedFormat = bookDoc.firstPublished
                ? bookDoc.firstPublishedFormat
                : firstPublished && firstPublished !== 'Invalid Date' && firstPublishedFormat
                ? firstPublishedFormat
                : null;
              if (isBookDataLatest) {
                bookDoc.latestGoodreadsUrl = bookUrl;
                bookDoc.description = bookData.description || bookDoc.description;
                bookDoc.descriptionHTML = bookData.descriptionHTML || bookDoc.descriptionHTML;
                bookDoc.descriptionHTMLShort =
                  bookData.descriptionHTMLShort || bookDoc.descriptionHTMLShort;
                bookDoc.ratingValue = bookData.ratingValue || bookDoc.ratingValue;
                bookDoc.ratingCount = bookData.ratingCount || bookDoc.ratingCount;
                bookDoc.reviewCount = bookData.reviewCount || bookDoc.reviewCount;
                bookDoc.coverImage = coverImageUrl
                  ? await imageUpload(coverImageUrl)
                  : bookDoc.coverImageUrl;
                bookDoc.bookEdition = bookData.bookEdition || bookDoc.bookEdition;
                bookDoc.bookFormat = bookData.bookFormat || bookDoc.bookFormat;
                bookDoc.numberOfPages = bookData.numberOfPages || bookDoc.numberOfPages;
                bookDoc.isbn13 = bookData.isbn13 || bookDoc.isbn13;
                bookDoc.authors = [...new Set([...bookData.authors, ...bookDoc.authors])];
                bookDoc.genres = [...new Set([...bookData.genres, ...bookDoc.genres])];
                bookDoc.latestPublished = latestPublished || bookDoc.latestPublished;
                bookDoc.latestPublishedFormat =
                  latestPublishedFormat || bookDoc.latestPublishedFormat;
                bookDoc.tags =
                  tags && tags.length !== 0 && tags.length >= bookDoc.tags.length
                    ? tags
                    : bookDoc.tags;
                bookDoc.series = series ? series : bookdoc.series;
                bookDoc.seriesNumber = seriesNumber ? seriesNumber : bookdoc.seriesNumber;
                bookDoc.booksInSeries = booksInSeries ? booksInSeries : bookdoc.booksInSeries;
              }
              bookDoc.updatedAt = Date.now();
              bookDoc.save();
              console.log(bookDoc);
            } catch (error) {
              console.error(error);
            }
          }
          await Link.findOneAndUpdate({ link: bookLinks[i] }, { dataScrapedAt: Date.now() });
        } catch (error) {
          console.error(error);
        }
      }
    }

    // await browser.close();
  } catch (error) {
    console.error(error);
  }
};

bookScraper();
