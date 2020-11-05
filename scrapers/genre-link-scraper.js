const puppeteer = require('puppeteer');

const selectors = require('../utils/selectors');
const scraperConfig = require('../config/scraper');
const Link = require('../models/linkModel');

require('../server')();

const linkScraper = async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
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

    const genresLinks = [];
    for (let i = 0; i < 5; i++) {
      try {
        const genresUrl = `https://www.goodreads.com/genres/list?page=${i + 1}`;
        await page.goto(genresUrl, scraperConfig.pageLoadOptions);

        // Get links to each genre page
        genresLinks.push(
          ...(await page.$$eval(selectors.genreLinks, links =>
            links.map(link => link.href.toLowerCase()),
          )),
        );
      } catch (error) {
        console.error(error);
      }
    }

    for (let i = 0; i < genresLinks.length; i++) {
      try {
        // Go to genres page
        await page.goto(genresLinks[i], scraperConfig.pageLoadOptions);

        const linkDoc = await Link.findOne({ link: genresLinks[i] });
        if (!linkDoc) {
          await Link.create({
            link: genresLinks[i],
          });
        } else {
          linkDoc.linksScrapedAt = Date.now();
          linkDoc.save();
        }

        const bookLinks = [];

        // Get links to more books, most read books or new releases pages
        const moreLinks = await page.$$eval(selectors.genreMoreLinks, links =>
          links.map(link => link.href.toLowerCase()),
        );

        // Get all links on this page
        bookLinks.push(...(await page.$$eval('a', helpers.scrapeHandler)));

        for (let i = 0; i < moreLinks.length; i++) {
          try {
            // Go to genre more books page
            await page.goto(moreLinks[i], scraperConfig.pageLoadOptions);

            // Get all links on page 1
            bookLinks.push(...(await page.$$eval('a', helpers.scrapeHandler)));

            const linkDoc = await Link.findOne({ link: moreLinks[i] });
            if (!linkDoc) {
              await Link.create({
                link: moreLinks[i],
              });
            } else {
              linkDoc.linksScrapedAt = Date.now();
              linkDoc.save();
            }

            let pageNumber = 1;

            // Loop through pagination by adding ?page=num to url
            for (let j = pageNumber; j < 5; j++) {
              try {
                pageNumber = j + 1;
                const url = `${moreLinks[i]}?page=${pageNumber}`;

                // Go to next page
                await page.goto(url, scraperConfig.pageLoadOptions);

                // Get book links
                const more = await page.$$eval(selectors.bookLinks, helpers.scrapeHandler);
                if (more.length === 0) break;
                bookLinks.push(...more);

                const linkDoc = await Link.findOne({ link: url });
                if (!linkDoc) {
                  await Link.create({
                    link: url,
                  });
                } else {
                  linkDoc.linksScrapedAt = Date.now();
                  linkDoc.save();
                }
              } catch (error) {
                console.error(error);
                continue;
              }
            }
          } catch (error) {
            console.error(error);
            continue;
          }
        }

        let linkArr = [...bookLinks];
        let depth = 1;
        const maxDepth = 1;

        while (depth <= maxDepth) {
          try {
            const nextLinkArr = [];
            for (let i = 0; i < linkArr.length; i++) {
              try {
                await page.goto(linkArr[i], scraperConfig.pageLoadOptions);

                const newLinks = [];
                if (linkArr[i].includes('book/show')) {
                  // Get lists related to book
                  const listElements = await page.evaluate(() => {
                    const divElements = document.querySelectorAll('.leftContainer > div > div');
                    return divElements && divElements.length !== 0
                      ? Array.from(divElements).reduce((acc, el) => {
                          if (el.innerText.toLowerCase().includes('lists with this book')) {
                            return [...acc, ...el.getElementsByTagName('a')];
                          }
                          return acc;
                        }, [])
                      : [];
                  });

                  newLinks.push(
                    ...[
                      ...new Set([
                        ...(await page.$$eval('.rightContainer a', helpers.scrapeHandler)),
                        ...helpers.scrapeHandler(listElements),
                      ]),
                    ],
                  );
                } else {
                  newLinks.push(...[...new Set(await page.$$eval('a', helpers.scrapeHandler))]);
                }
                nextLinkArr.push(...newLinks);

                for (let i = 0; i < newLinks.length; i++) {
                  try {
                    const linkDoc = await Link.findOne({ link: newLinks[i] });
                    if (!linkDoc) {
                      await Link.create({
                        link: newLinks[i],
                      });
                    } else {
                      linkDoc.linksScrapedAt = Date.now();
                      linkDoc.save();
                    }
                  } catch (error) {
                    console.error(error);
                    continue;
                  }
                }
              } catch (error) {
                console.error(error);
                continue;
              }
            }
            linkArr = [...nextLinkArr];
            depth++;
          } catch (error) {
            console.error(error);
            continue;
          }
        }
      } catch (error) {
        console.log(error);
      }
    }

    // await browser.close();
  } catch (error) {
    console.log(error);
  }
};

linkScraper();
