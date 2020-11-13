const puppeteer = require('puppeteer');
const moment = require('moment');

require('../server')();

const helpers = require('../utils/helpers');
const selectors = require('../utils/selectors');
const imageUpload = require('../utils/imageUpload');
const scraperConfig = require('../config/scraper');
const Book = require('../models/bookModel');
const Link = require('../models/linkModel');

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

    let loopCount = 0;
    let scrapedLinksCount = 0;
    let newBooksCount = 0;
    let updatedBooksCount = 0;
    while (true) {
      try {
        loopCount++;

        const sort = 'dataScrapedAt';
        const pageNumber = process.argv[2] * 1 || 1;
        const limit = 5000;
        const skip = (pageNumber - 1) * limit;

        const dbLinks = await Link.find({ link: { $regex: 'book/show' } })
          .sort(sort)
          .select('link')
          .skip(skip)
          .limit(limit);
        const bookLinks = helpers.shuffleArray([...new Set(dbLinks.map(el => el.link))]);

        for (let i = 0; i < bookLinks.length; i++) {
          try {
            const bookUrl = bookLinks[i];
            if (!bookUrl.includes('book/show')) continue;

            await page.goto(bookUrl, scraperConfig.pageLoadOptions);

            // Get links on book page
            const scrapedLinks = [];
            const listLinks = await page.$$eval('.leftContainer a', links => {
              return links
                .filter(el => {
                  if (!el || !el.href) {
                    return false;
                  }
                  return new RegExp(
                    /^(https:\/\/www.goodreads.com\/|\/)(list\/show|list\/book)[\/?#]/,
                  ).test(el.href.toLowerCase());
                })
                .map(el => {
                  let url = el.href.toLowerCase().split('#')[0];
                  if (url.includes('book/show')) {
                    url = url.split('?')[0];
                  }
                  url = url.replace(/\/+$/, '');
                  if (!url.startsWith('https://www.goodreads.com') && url.startsWith('/')) {
                    url = 'https://www.goodreads.com' + url;
                  }
                  return url;
                });
            });

            scrapedLinks.push(
              ...[
                ...new Set([
                  ...(await page.$$eval('.rightContainer a', helpers.scrapeHandler)),
                  ...listLinks,
                ]),
              ],
            );

            for (let j = 0; j < scrapedLinks.length; j++) {
              try {
                const linkDoc = await Link.findOne({ link: scrapedLinks[j] });
                if (!linkDoc) {
                  await Link.create({
                    link: scrapedLinks[j],
                  });
                }
              } catch (error) {
                console.error(error);
              }
            }

            await Link.updateOne({ link: bookUrl }, { linksScrapedAt: Date.now() });

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
                  bookElements.ratingValue.innerText &&
                  !isNaN(bookElements.ratingValue.innerText)
                ) {
                  ratingValue = Number(bookElements.ratingValue.innerText);
                }

                let ratingCount = null;
                if (
                  bookElements.ratingCount &&
                  bookElements.ratingCount.content &&
                  !isNaN(bookElements.ratingCount.content)
                ) {
                  ratingCount = Number(bookElements.ratingCount.content);
                }

                let reviewCount = null;
                if (
                  bookElements.reviewCount &&
                  bookElements.reviewCount.content &&
                  !isNaN(bookElements.reviewCount.content)
                ) {
                  reviewCount = Number(bookElements.reviewCount.content);
                }

                let numberOfPages = null;
                const numberOfPagesMatch =
                  bookElements.numberOfPages && bookElements.numberOfPages.innerText
                    ? bookElements.numberOfPages.innerText.match(/\d+/)
                    : null;
                if (numberOfPagesMatch && !isNaN(numberOfPagesMatch[0])) {
                  numberOfPages = Number(numberOfPagesMatch[0]);
                }

                let isbn = null;
                if (
                  bookElements.isbn &&
                  bookElements.isbn.content &&
                  bookElements.isbn.content !== 'null'
                ) {
                  isbn = bookElements.isbn.content;
                }

                return {
                  coverImageUrl: bookElements.coverImage ? bookElements.coverImage.src : null,
                  title:
                    bookElements.title && bookElements.title.innerText
                      ? bookElements.title.innerText.trim()
                      : null,
                  seriesLink: bookElements.series ? bookElements.series.href : null,
                  authors:
                    bookElements.authors && bookElements.authors.length !== 0
                      ? Array.from(bookElements.authors).map(el =>
                          el.innerText ? el.innerText.trim() : null,
                        )
                      : [],
                  descriptionHTML:
                    bookElements.description && bookElements.description.length !== 0
                      ? Array.from(bookElements.description).reduce((acc, el) => {
                          if (el.innerText && el.innerText.length > acc.length) return el.innerHTML;
                          return acc;
                        }, '')
                      : null,
                  ratingValue,
                  ratingCount,
                  reviewCount,
                  isbn,
                  numberOfPages,
                  relatedBooksUrls:
                    bookElements.relatedBooks && bookElements.relatedBooks.length !== 0
                      ? Array.from(bookElements.relatedBooks)
                          .map(link => {
                            if (link.href) {
                              const bookLink = link.href
                                .toLowerCase()
                                .split('#')[0]
                                .split('?')[0]
                                .replace(/\/+$/, '');
                              return !bookLink.startsWith('https://www.goodreads.com') &&
                                bookLink.startsWith('/')
                                ? 'https://www.goodreads.com' + bookLink
                                : bookLink;
                            }
                            return null;
                          })
                          .filter(Boolean)
                      : [],
                  latestPublishedString,
                  firstPublishedString,
                  genres:
                    bookElements.genres && bookElements.genres.length !== 0
                      ? [
                          ...new Set(
                            Array.from(bookElements.genres)
                              .map(el => {
                                if (el.innerText) {
                                  return el.innerText.toLowerCase().trim();
                                }
                                return null;
                              })
                              .filter(Boolean),
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

            let tags = [];
            if (tagsLink && typeof tagsLink === 'string') {
              try {
                await page.goto(tagsLink, scraperConfig.pageLoadOptions);
                tags = await page.evaluate(() => {
                  const tagElements = document.querySelectorAll('.mainContent .leftContainer a');
                  return Array.from(tagElements)
                    .filter(
                      el =>
                        el.href &&
                        el.href.includes('genres') &&
                        el.innerText &&
                        el.innerText.search(
                          /book|read|own|have|star|my|wishlist|wish-list|to-buy|\d{4}|tbr/,
                        ) === -1,
                    )
                    .map(el => {
                      if (el.innerText) {
                        return el.innerText.toLowerCase().trim();
                      }
                      return null;
                    })
                    .slice(0, 20);
                });
              } catch (error) {
                console.error(error);
              }
            }

            let series = null;
            let seriesNumber = null;
            let seriesBooksUrls = [];
            if (seriesLink && typeof seriesLink === 'string') {
              try {
                await page.goto(seriesLink, scraperConfig.pageLoadOptions);
                const seriesData = await page.evaluate(
                  args => {
                    let seriesNumber;
                    const { title } = args;
                    const bookElements = document.querySelectorAll('.listWithDividers__item');
                    const seriesBooksUrls =
                      bookElements && bookElements.length !== 0
                        ? Array.from(bookElements).map(el => {
                            const h3Tags = el.getElementsByTagName('h3');
                            const bookNumberTextRaw =
                              h3Tags && h3Tags.length !== 0 ? h3Tags[0].innerText : null;
                            const bookNumberText = bookNumberTextRaw
                              ? bookNumberTextRaw.trim().toLowerCase()
                              : null;
                            const bookNumberMatch = bookNumberText
                              ? bookNumberText.match(/book (.+)/)
                              : null;
                            const bookNumber =
                              bookNumberMatch && bookNumberMatch.length >= 2
                                ? bookNumberMatch[1]
                                : null;

                            const aTags = el.getElementsByTagName('a');

                            const bookLinkRaw = aTags && aTags.length !== 0 && aTags[0].href;
                            const bookLink = bookLinkRaw
                              ? bookLinkRaw
                                  .toLowerCase()
                                  .split('#')[0]
                                  .split('?')[0]
                                  .replace(/\/+$/, '')
                              : null;
                            const bookLinkFinal = bookLink
                              ? !bookLink.startsWith('https://www.goodreads.com') &&
                                bookLink.startsWith('/')
                                ? 'https://www.goodreads.com' + bookLink
                                : bookLink
                              : null;

                            const bookTitle =
                              aTags && aTags.length !== 0 && aTags[1].innerText
                                ? aTags[1].innerText
                                : null;

                            if (
                              bookTitle &&
                              title &&
                              bookTitle.trim().toLowerCase() === title.trim().toLowerCase()
                            ) {
                              seriesNumber = bookNumber;
                            }
                            return bookLinkFinal;
                          })
                        : [];
                    const seriesTitleEl = document.querySelector('h1');
                    const series =
                      seriesTitleEl &&
                      seriesTitleEl.innerText &&
                      seriesTitleEl.innerText.includes('Series')
                        ? seriesTitleEl.innerText.split(' Series')[0].trim()
                        : null;
                    return {
                      seriesBooksUrls,
                      series,
                      seriesNumber,
                    };
                  },
                  {
                    title: bookData.title,
                  },
                );
                series = seriesData.series;
                seriesBooksUrls = seriesData.seriesBooksUrls;
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

            let latestPublished = null;
            let latestPublishedFormat = null;
            if (latestPublishedString) {
              const latestContainsDay = dayRegex.test(latestPublishedString);
              const latestContainsMonth = monthRegex.test(latestPublishedString);
              const latestContainsYear = yearRegex.test(latestPublishedString);

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

              if (latestPublishedString && latestPublishedFormat) {
                latestPublished = moment(latestPublishedString, latestPublishedFormat)
                  .utc()
                  .format();
              }
            }

            let firstPublished = null;
            let firstPublishedFormat = null;
            if (firstPublishedString) {
              const firstContainsDay = dayRegex.test(firstPublishedString);
              const firstContainsMonth = monthRegex.test(firstPublishedString);
              const firstContainsYear = yearRegex.test(firstPublishedString);

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

              if (firstPublishedString && firstPublishedFormat) {
                firstPublished = moment(firstPublishedString, firstPublishedFormat).utc().format();
              }
            }

            const bookDoc = await Book.findOne({ goodreadsUrl: bookUrl });
            if (!bookDoc) {
              try {
                await Book.create({
                  ...bookData,
                  goodreadsUrl: bookUrl,
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
                  seriesBooksUrls,
                  updatedAt: Date.now(),
                });
                newBooksCount++;
              } catch (error) {
                console.error(error);
              }
            } else {
              try {
                bookDoc.latestPublished =
                  latestPublished && latestPublished !== 'Invalid date'
                    ? latestPublished
                    : bookDoc.latestPublished;
                bookDoc.latestPublishedFormat =
                  latestPublished && latestPublished !== 'Invalid Date'
                    ? latestPublishedFormat
                    : bookDoc.latestPublishedFormat;
                bookDoc.firstPublished =
                  firstPublished && firstPublished !== 'Invalid date'
                    ? firstPublished
                    : bookDoc.firstPublished;
                bookDoc.firstPublishedFormat =
                  firstPublished && firstPublished !== 'Invalid Date'
                    ? firstPublishedFormat
                    : bookDoc.firstPublishedFormat;
                bookDoc.relatedBooksUrls = [
                  ...new Set([...bookData.relatedBooksUrls, ...bookDoc.relatedBooksUrls]),
                ];
                bookDoc.ratingValue = bookData.ratingValue || bookDoc.ratingValue;
                bookDoc.ratingCount = bookData.ratingCount || bookDoc.ratingCount;
                bookDoc.reviewCount = bookData.reviewCount || bookDoc.reviewCount;
                bookDoc.genres = [...new Set([...bookData.genres, ...bookDoc.genres])];
                bookDoc.tags = [...new Set([...tags, ...bookDoc.tags])];
                bookDoc.series = series || bookDoc.series;
                bookDoc.seriesNumber = seriesNumber || bookDoc.seriesNumber;
                bookDoc.seriesBooksUrls =
                  seriesBooksUrls && seriesBooksUrls.length !== 0
                    ? seriesBooksUrls
                    : bookDoc.seriesBooksUrls;
                bookDoc.description = bookData.description || bookDoc.description;
                bookDoc.descriptionHTML = bookData.description || bookDoc.descriptionHTML;
                bookDoc.descriptionHTMLShort = bookData.description || bookDoc.descriptionHTMLShort;
                bookDoc.isbn = bookData.isbn || bookDoc.isbn;
                bookDoc.numberOfPages = bookData.numberOfPages || bookDoc.numberOfPages;
                bookDoc.authors =
                  bookData.authors && bookData.authors.length !== 0
                    ? bookData.authors
                    : bookDoc.authors;
                bookDoc.bookEdition = bookData.bookEdition || bookDoc.bookEdition;
                bookDoc.bookFormat = bookData.bookFormat || bookDoc.bookFormat;
                bookDoc.updatedAt = Date.now();
                bookDoc.save();
                updatedBooksCount++;
              } catch (error) {
                console.error(error);
              }
            }
            scrapedLinksCount++;
            await Link.updateOne({ link: bookUrl }, { dataScrapedAt: Date.now() });
            if (scrapedLinksCount % 100 === 0) {
              console.log({ loopCount, newBooksCount, updatedBooksCount, scrapedLinksCount });
            }
          } catch (error) {
            console.error(error);
          }
        }
      } catch (error) {
        console.error(error);
      }
    }
  } catch (error) {
    console.error(error);
  }
};

bookScraper();
