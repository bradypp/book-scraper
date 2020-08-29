const puppeteer = require('puppeteer');

const selectors = require('./selectors');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const pageLoadOptions = {
        waitUntil: 'networkidle0',
    };

    const urls = ['https://www.goodreads.com/genres/list'];

    await page.goto(urls[0], pageLoadOptions);

    const getLinks = async (selector) => {
        return await page.$$eval(selector, (links) => links.map((link) => link.href));
    };

    // Get links to each genre page
    const genresLinks = await page.$$eval(selectors.genresPage, (genres) =>
        genres.map((genre) => genre.href)
    );

    for (let i = 0; i < genresLinks.length; i++) {
        // Go to genres page
        await page.goto(genresLinks[i], pageLoadOptions);

        // Get links to more books, most read books or new releases pages
        const moreLinks = await getLinks(selectors.genresMore);

        for (let i = 0; i < moreLinks.length; i++) {
            // Go to genre more books page
            await page.goto(moreLinks[i], pageLoadOptions);

            // Get book links
            const bookLinks = await page.$$eval(selectors.booksLinks, (links) =>
                links.map((link) => link.href)
            );

            // Get pagination links
            const paginationLinks = await page.$$eval(selectors.genresPagination, (links) =>
                links.map((link) => link.href)
            );

            // Loop through pagination links to get all books
            for (let i = 0; i < paginationLinks.length; i++) {
                // Go to next page
                await page.goto(moreLinks[i], pageLoadOptions);

                // Get book links on next page
                const bookLinks = await page.$$eval(selectors.booksLinks, (links) =>
                    links.map((link) => link.href)
                );
                console.log(bookLinks);
            }
        }
    }

    // const bookData = await page.evaluate(
    //     (args) => {
    //         const { bookPageSelectors } = args;

    //         const bookElements = {};
    //         bookPageSelectors.forEach((el) => {
    //             if (el.isXPathSelector) {
    //                 bookElements[el.name] = getElementFromXPath(el.selector);
    //             } else {
    //                 bookElements[el.name] = el.isIteratable
    //                     ? document.querySelectorAll(el.selector)
    //                     : document.querySelector(el.selector);
    //             }
    //         });

    //         const bookData = {
    //             cover: bookElements?.cover?.src,
    //             title: bookElements?.title?.innerText,
    //             series: bookElements?.series?.innerText,
    //             authors: Array.from(bookElements?.authors).map((el) => el.innerText),
    //             description: Array.from(bookElements?.description).reduce((acc, el) => {
    //                 if (el.innerText.length > acc.length) return el.innerText;
    //                 return acc;
    //             }, ''),
    //         };

    //         return { bookData };
    //     },
    //     { bookPageSelectors: selectors.bookPage }
    // );
    // console.log(bookData);

    await browser.close();
})();
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
