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

    // Get links to each genre page
    const genresLinks = await page.$$eval(selectors.genreLinks, links =>
      links.map(link => link.href),
    );

    for (let i = 0; i < genresLinks.length; i++) {
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
      let bookLinks = [];

      // Get links to more books, most read books or new releases pages
      const moreLinks = await page.$$eval(selectors.genreMoreLinks, links =>
        links.map(link => link.href),
      );

      // Get all links on this page
      bookLinks.push(
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

      for (let i = 0; i < moreLinks.length; i++) {
        // Go to genre more books page
        await page.goto(moreLinks[i], scraperConfig.pageLoadOptions);

        // Get book links
        bookLinks.push(
          ...(await page.$$eval(selectors.bookLinks, links =>
            links.map(el => {
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

        // Get all links on this page
        bookLinks.push(
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
          pageNumber = j + 1;
          const url = `${moreLinks[i]}?page=${pageNumber}`;

          // Go to next page
          await page.goto(url, scraperConfig.pageLoadOptions);

          // Get book links
          const more = await page.$$eval(selectors.bookLinks, links =>
            links.map(el => {
              let url = el.href;
              if (url.includes('#')) {
                url = url.split('#')[0];
              }
              if (!url.startsWith('https://www.goodreads.com')) {
                url = 'https://www.goodreads.com' + url;
              }
              return url;
            }),
          );
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
        }
      }

      let linkArr = [...bookLinks];
      let depth = 1;
      const maxDepth = 3;

      while (depth <= maxDepth) {
        const nextLinkArr = [];
        for (let i = 0; i < linkArr.length; i++) {
          try {
            await page.goto(linkArr[i], scraperConfig.pageLoadOptions);
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
              }
            }
          } catch (error) {
            console.error(error);
          }
        }
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
