const puppeteer = require('puppeteer');

const helpers = require('../utils/helpers');
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

    while (true) {
      try {
        // Carry on from where you left off
        const dbLinks = await Link.find().sort('linksScrapedAt').limit(30000);
        let startingLinks = dbLinks.map(el => el.link);

        const newLinks = [];
        // Get links from starting page if none in db
        if (startingLinks.length === 0) {
          await page.goto('https://www.goodreads.com/book', scraperConfig.pageLoadOptions);
          startingLinks.push(...(await page.$$eval('a', helpers.scrapeHandler)));
          newLinks.push(...startingLinks);
        }

        startingLinks = helpers.shuffleArray(startingLinks);
        
        for (let i = 0; i < startingLinks.length; i++) {
          try {
            await page.goto(startingLinks[i], scraperConfig.pageLoadOptions);

            if (startingLinks[i].includes('book/show')) {
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

            for (let j = 0; j < newLinks.length; j++) {
              try {
                const linkDoc = await Link.findOne({ link: newLinks[j] });
                if (!linkDoc) {
                  await Link.create({
                    link: newLinks[j],
                  });
                } else {
                  linkDoc.linksScrapedAt = Date.now();
                  linkDoc.save();
                }
                console.log('Link Scraped');
              } catch (error) {
                console.error(error);
              }
            }
          } catch (error) {
            console.error(error);
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
