const puppeteer = require('puppeteer');

const selectors = require('./utils/selectors');
const scraperConfig = require('./config/scraper');

const scraper = async () => {
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

    const genresUrl = 'https://www.goodreads.com/genres/list';
    await page.goto(genresUrl, scraperConfig.pageLoadOptions);

    const getLinks = async selector =>
        await page.$$eval(selector, links => links.map(link => link.href));

    // Get links to each genre page
    const genresLinks = await getLinks(selectors.genreLinks);

    for (let i = 0; i < genresLinks.length; i++) {
        // Go to genres page
        await page.goto(genresLinks[i], scraperConfig.pageLoadOptions);

        // Get links to more books, most read books or new releases pages
        const moreLinks = await getLinks(selectors.genreMoreLinks);

        let bookLinks = [];
        for (let i = 0; i < moreLinks.length; i++) {
            // Go to genre more books page
            await page.goto(moreLinks[i], scraperConfig.pageLoadOptions);

            // Get book links
            bookLinks.push(...(await getLinks(selectors.bookLinks)));

            let pageNumber = 1;

            // Loop through pagination by adding ?page=num to url
            for (let j = pageNumber; j < 50; j++) {
                pageNumber = j + 1;
                const url = `${moreLinks[i]}?page=${pageNumber}`;

                // Go to next page
                await page.goto(url, scraperConfig.pageLoadOptions);

                // Get book links
                const more = await getLinks(selectors.bookLinks);
                if (more.length === 0) break;
                bookLinks.push(...more);
            }
        }
        bookLinks = bookLinks.flat();

        // Get book data for the first 500 books in each genre
        for (let i = 0; i < bookLinks.length; i++) {
            // Go to each book page
            await page.goto(bookLinks[i], scraperConfig.pageLoadOptions);

            // Get book data
            const bookData = await page.evaluate(
                args => {
                    const { selectors } = args;
                    /* 
                        TODO:
                        Get book data
                        Save data to the database
                        Get related books links
                        Loop through related books and get their data
                        Save data to the database
                        Link related books to the parent book
                    */

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
                        cover: bookElements?.cover?.src,
                        title: bookElements?.title?.innerText,
                        series: bookElements?.series?.innerText,
                        authors: Array.from(bookElements?.authors).map(el => el.innerText),
                        description: Array.from(bookElements?.description).reduce((acc, el) => {
                            if (el.innerText.length > acc.length) return el.innerText;
                            return acc;
                        }, ''),
                    };

                    return { bookData };
                },
                { selectors: selectors.bookPage },
            );
            console.log(bookData);
        }
    }

    await browser.close();
};

module.exports = scraper;
// const puppeteer = require('puppeteer');
// const models = require('./models');

// (async () => {
//     const browser = await puppeteer.launch({ headless: true });
//     const page = await browser.newPage();
//     await page.goto('https://www.goodreads.com/book/show/40604556-red-seas-under-red-skies', {
//         waitUntil: 'networkidle0',
//     });

//     const data = await page.evaluate(
//         (args) => {
//             const { models } = args;
//             const { book } = models;

//             const getElementFromXPath = (xpath, isIteratable = false) => {
//                 return document.evaluate(
//                     xpath,
//                     document,
//                     null,
//                     XPathResult.FIRST_ORDERED_NODE_TYPE,
//                     null
//                 ).singleNodeValue;
//             };

//             const bookElements = {};
//             book.forEach((el) => {
//                 if (el.isXPathSelector) {
//                     bookElements[el.name] = getElementFromXPath(el.selector);
//                 } else {
//                     bookElements[el.name] = el.isIteratable
//                         ? document.querySelectorAll(el.selector)
//                         : document.querySelector(el.selector);
//                 }
//             });

//             const bookData = {
//                 cover: bookElements.cover.src,
//                 title: bookElements.title.innerText,
//                 series: bookElements.series.innerText,
//                 authors: Array.from(bookElements.authors).map((el) => el.innerText),
//                 description: Array.from(bookElements.description).reduce((acc, el) => {
//                     if (el.innerText.length > acc.length) return el.innerText;
//                     return acc;
//                 }, ''),
//             };

//             return { bookData };
//         },
//         { models }
//     );

//     console.log(data);
//     await browser.close();
// })();
