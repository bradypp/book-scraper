const puppeteer = require('puppeteer');

const selectors = require('../utils/selectors');
const scraperConfig = require('../config/scraper');
const Book = require('../models/bookModel');
const Link = require('../models/linkModel');

require('../server')();

const bookScraper = async () => {
  try {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

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
      const linkDocs = await Link.find({ links: { $regex: '/book/show/' } })
        .sort('updated_at')
        .select('links updated_at')
        .limit(100);
      const bookRegex = new RegExp(/^(https:\/\/www.goodreads.com\/|\/)(book\/show)[\/?#]/);
      // Get links

      for (let i = 0; i < linkDocs.length; i++) {
        const currentDoc = linkDocs[i];
        const bookLinks = currentDoc.links.filter(href => bookRegex.test(href));

        // Update each link doc
        currentDoc.updated_at = Date.now();
        currentDoc.save();

        for (let j = 0; j < bookLinks.length; j++) {
          try {
            // Go to each book page
            await page.goto(bookLinks[j], scraperConfig.pageLoadOptions);

            // Get book data
            /* 
              TODO: 
              get all genres & tags
              get related books by going to url & all links on page containing regex /book/show/
              get goodreads id from url regex \/book\/show\/(\d+) (or by looking for attr data-book-id on #buyButtonContainer)
              get isbn by looping through #bookDataBox children divs, if first child inner text === 'isbn' (toLower() it) get the siblings contents
              get isbn13 from meta tag property="books:isbn" content (or the after isbn contents of child div from above) isbn13 should be primary
              get page count from meta tag property="books:page_count" content (or itemprop="numberOfPages")
              get book format itemprop="bookFormat"
              get language itemprop="inLanguage"
              get date loop through #details children for innerText containing 'published' get the following text up to 'by' for published date & year after 'first published' for first published date (first published should be the primary date)
              get every relevant url e.g. author, related books etc.
            */
            const bookData = await page.evaluate(
              args => {
                const { selectors, bookUrl } = args;

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

                const bookData = {
                  goodreads_url: `${location.protocol}//${location.host}${location.pathname}`,
                  cover: bookElements.cover && bookElements.cover.src,
                  title: bookElements.title && bookElements.title.innerText,
                  series_raw: bookElements.series && bookElements.series.innerText,
                  series: bookElements.series && bookElements.series.innerText.slice(1, -4),
                  series_with_number:
                    bookElements.series && bookElements.series.innerText.slice(1, -1),
                  series_number: bookElements.series && bookElements.series.innerText.slice(-2, -1),
                  authors:
                    bookElements.authors &&
                    Array.from(bookElements.authors).map(el => el.innerText),
                  description:
                    bookElements.description &&
                    Array.from(bookElements.description).reduce((acc, el) => {
                      if (el.innerText && el.innerText.length > acc.length) return el.innerText;
                      return acc;
                    }, ''),
                  description_HTML:
                    bookElements.description &&
                    Array.from(bookElements.description).reduce((acc, el) => {
                      if (el.innerText && el.innerText.length > acc.length) return el.innerHTML;
                      return acc;
                    }, ''),
                  description_HTML_short:
                    bookElements.description &&
                    Array.from(bookElements.description).reduce((acc, el) => {
                      if (acc.length === 0) return el.innerHTML;
                      if (el.innerText && el.innerText.length < acc.length) return el.innerHTML;
                      return acc;
                    }, ''),
                  rating_value: bookElements.ratingValue && bookElements.ratingValue.innerText,
                  rating_count: bookElements.ratingCount && bookElements.ratingCount.content,
                  related_books_urls:
                    bookElements.relatedBooks &&
                    Array.from(bookElements.relatedBooks).map(link => link.href),
                };

                return bookData;
              },
              { selectors: selectors.bookPage },
            );

            console.log({
              ...bookData,
            });
          } catch (error) {
            console.error(error);
          }
        }
      }
    }

    // await browser.close();
  } catch (error) {}
};

bookScraper();
