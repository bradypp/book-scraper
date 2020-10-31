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

    const genresUrl = 'https://www.goodreads.com/genres/list';
    await page.goto(genresUrl, scraperConfig.pageLoadOptions);

    const getLinks = async selector =>
      await page.$$eval(selector, links => links.map(link => link.href));

    // Get links to each genre page
    const genresLinks = await getLinks(selectors.genreLinks);

    for (let i = 0; i < genresLinks.length; i++) {
      // Go to genres page
      await page.goto(genresLinks[i], scraperConfig.pageLoadOptions);

      // TODO Loop through more links and just get all links on page instead of specific books
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

      if (bookLinks.length !== 0) {
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

      const doneLinks = [...bookLinks];
      let linkArr = [...bookLinks];
      let depth = 1;
      const maxDepth = 1;

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
                console.log(filteredLinks);
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
