const puppeteer = require('puppeteer');

const helpers = require('../utils/helpers');
const selectors = require('../utils/selectors');
const scraperConfig = require('../config/scraper');
const Link = require('../models/linkModel');

require('../server')();

const linkScraper = async (filter, sort = '-createdAt', limit = 10000) => {
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

    let loopCount = 0;
    let scrapedLinksCount = 0;
    let newLinksCount = 0;
    while (true) {
      try {
        loopCount++;

        const pageNumber = process.argv[2] * 1 || 1;
        const skip = (pageNumber - 1) * limit;

        // Scrape the newest links saved for more
        const dbLinks = await Link.find(filter).sort(sort).select('link blacklisted').skip(skip).limit(limit);
        let startingLinks = dbLinks.map(el => el.link);
        const scrapedLinks = [];

        // Get links from starting page if none in db
        if (startingLinks.length === 0) {
          await page.goto('https://www.goodreads.com/book', scraperConfig.pageLoadOptions);
          startingLinks.push(...(await page.$$eval('a', helpers.scrapeHandler)));
          scrapedLinks.push(...startingLinks);
        }
        // startingLinks = helpers.shuffleArray(startingLinks);

        for (let i = 0; i < startingLinks.length; i++) {
          try {
            if (startingLinks[i].blacklisted) continue;
            await page.goto(startingLinks[i], scraperConfig.pageLoadOptions);

            if (startingLinks[i].includes('book/show')) {
              // Get lists related to book
              const listLinks = await page.$$eval('.leftContainer a', links => {
                return links
                  .filter(el => {
                    if (!el || !el.href) {
                      return false;
                    }
                    return new RegExp(/^(https:\/\/www.goodreads.com\/|\/)(list\/show)[\/?#]/).test(
                      el.href.toLowerCase(),
                    );
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
            } else {
              scrapedLinks.push(...[...new Set(await page.$$eval('a', helpers.scrapeHandler))]);
            }

            for (let j = 0; j < scrapedLinks.length; j++) {
              try {
                const linkDoc = await Link.findOne({ link: scrapedLinks[j] });
                if (!linkDoc) {
                  await Link.create({
                    link: scrapedLinks[j],
                  });
                  newLinksCount++;
                }
              } catch (error) {
                console.error(error);
              }
            }
            scrapedLinksCount++;
            console.log({ loopCount, newLinksCount, scrapedLinksCount, link: startingLinks[i] });
            newLinksCount = 0;

            await Link.updateOne({ link: startingLinks[i] }, { linksScrapedAt: Date.now() });
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

module.exports = linkScraper;
