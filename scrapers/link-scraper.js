const puppeteer = require('puppeteer');

const selectors = require('../utils/selectors');
const scraperConfig = require('../config/scraper');
const Link = require('../models/linkModel');

require('../server')();

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
    
    while (true) {
      // Carry on from where you left off
      const dbLinks = await Link.find().sort('-updated_at').select('links').limit(500);
      const scrapedLinks = [... new Set(dbLinks.map(doc => doc.links).flat())];
console.log(scrapedLinks);
      // Get links from starting page if none in db
      if (scrapedLinks.length === 0) {
        scrapedLinks.push(
          ...(await page.$$eval('a', links =>
            links
              .map(link =>
                link.href,
              )
              .filter(href =>
                new RegExp(
                  /^(https:\/\/www.goodreads.com\/|\/)(book\/show|books|list|genre|genres|recommendations|tag|series|author\/show|characters|choiceawards|new_releases|workshelves)[\/?#]/,
                ).test(href),
              ),
          )),
        );
      }

      // TODO Make it so that each link has it's own doc, use regex to detect a category such as book, author, series, genre etc.
      // TODO Have an updated_at property to use when that page is scraped for data e.g. book data & a scraped_at property for when last scraped for links
      const doneLinks = [...scrapedLinks];
      let linkArr = [...scrapedLinks];
      let depth = 1;
      const maxDepth = 1000;

      while (depth <= maxDepth) {
        const nextLinkArr = [];
        for (let i = 0; i < linkArr.length; i++) {
          try {
            const url = linkArr[i];
            await page.goto(url, scraperConfig.pageLoadOptions);
            const newLinks = await page.$$eval('a', links =>
            links
            .map(link => link.href)
            .filter(href =>
              new RegExp(
                /^(https:\/\/www.goodreads.com\/|\/)(book\/show|books|list|genre|genres|recommendations|tag|series|author\/show|characters|choiceawards|new_releases|workshelves)[\/?#]/,
                ).test(href),
                ),
                );
                const filteredLinks = [
                  ...new Set(newLinks.filter(link => doneLinks.indexOf(link) === -1)),
                ];
            nextLinkArr.push(...filteredLinks);

            if (filteredLinks.length !== 0) {
              try {
                const linkDoc = await Link.findOne({ links_source: url });
                if (!linkDoc) {
                  await Link.create({
                    links_source: url,
                    links: filteredLinks,
                  });
                } else {
                  linkDoc.links = filteredLinks;
                  linkDoc.updated_at = Date.now();
                  linkDoc.save();
                }
              } catch (error) {}
            }
            getPageLinks(filteredLinks, depth++);
          } catch (error) {}
        }
        doneLinks.push(...nextLinkArr);
        linkArr = [...nextLinkArr];
        depth++;
      }
    }

    // await browser.close();
  } catch (error) {
    console.log(error);
  }
};

linkScraper();
