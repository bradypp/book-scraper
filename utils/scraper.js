const constants = require('./constants');

exports.autoScroll = async page => {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 100;
      // eslint-disable-next-line no-var
      var timer = setInterval(() => {
        const { scrollHeight } = document.body;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
};

exports.getElementFromXPath = async (page, xpath) => {
  const res = await page.$x(xpath);
  await res[0].evaluate(x => x.children);
};

exports.getLinks = async (page, selector) =>
  page.$$eval(selector, links => links.map(link => link.href));

exports.getPageLinks = async (linksArr = [], depth = 1, maxDepth) => {
  if (linksArr.length !== 0 && maxDepth && depth <= maxDepth) {
    for (let i = 0; i < linksArr.length; i++) {
      try {
        const url = linksArr[i];
        await page.goto(url, scraperConfig.pageLoadOptions);
        const newLinks = await page.$$eval('a', links =>
          links
            .map(link => link.href)
            .filter(href => new RegExp(constants.GLOBAL_LINK_REGEX).test(href)),
        );
        const filteredLinks = [
          ...new Set(newLinks.filter(link => localLinks.indexOf(link) === -1)),
        ];
        localLinks.push(...filteredLinks);

        if (filteredLinks.length !== 0) {
          const linkDoc = await Link.findOne({ links_source: url });
          if (!linkDoc) {
            await Link.create({
              links_source: url,
              links: filteredLinks,
            });
          } else {
            linkDoc.links = filteredLinks;
            linkDoc.updatedAt = Date.now();
            linkDoc.save();
          }
        }
        getPageLinks(filteredLinks, depth++);
      } catch (error) {}
    }
  }
};
