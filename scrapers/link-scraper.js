const puppeteer = require('puppeteer');

const selectors = require('../utils/selectors');
const scraperConfig = require('../config/scraper');
const Link = require('../models/linkModel');

require('../server')();

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

const linkScraper = async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
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

    let limit = 4000;

    while (true) {
      // Carry on from where you left off
      const dbLinks = await Link.find()
        .sort('-linksScrapedAt')
        .limit(limit < 50000 ? limit : 50000);
      let startingLinks = dbLinks.map(el => el.link);

      // Get links from starting page if none in db
      if (startingLinks.length === 0) {
        startingLinks.push(
          ...(await page.$$eval('a', links =>
            links
              .filter(el =>
                new RegExp(
                  /^(https:\/\/www.goodreads.com\/|\/)(book\/show|books|list|genre|genres|recommendations|tag|series|author\/show|choiceawards|new_releases|workshelves)[\/?]/,
                ).test(el.href),
              )
              .map(el => {
                let url = el.href;
                if (url.includes('#')) {
                  url = url.split('#')[0];
                }
                if (!url.startsWith('https://www.goodreads.com')) {
                  url = 'https://www.goodreads.com' + url;
                }
                return url;
              }),
          )),
        );
      }

      startingLinks = shuffle(startingLinks);

      // Reset limit
      limit = 0;

      for (let i = 0; i < startingLinks.length; i++) {
        try {
          await page.goto(startingLinks[i], scraperConfig.pageLoadOptions);
          const newLinks = [
            ...new Set(
              await page.$$eval('a', links =>
                links
                  .filter(el =>
                    new RegExp(
                      /^(https:\/\/www.goodreads.com\/|\/)(book\/show|books|list|genre|genres|recommendations|tag|series|author\/show|choiceawards|new_releases|workshelves)[\/?]/,
                    ).test(el.href),
                  )
                  .map(el => {
                    let url = el.href;
                    if (url.includes('#')) {
                      url = url.split('#')[0];
                    }
                    if (!url.startsWith('https://www.goodreads.com')) {
                      url = 'https://www.goodreads.com' + url;
                    }
                    return url;
                  }),
              ),
            ),
          ];
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
            } catch (error) {
              console.error(error);
            }
          }
          limit += newLinks.length;
        } catch (error) {
          console.error(error);
        }
      }
    }

    // await browser.close();
  } catch (error) {
    console.log(error);
  }
};

linkScraper();
