/* eslint-disable no-undef */
module.exports = {
    autoScroll: async page => {
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
    },
    getElementFromXPath: async (page, xpath) => {
        const res = await page.$x(xpath);
        await res[0].evaluate(x => x.children);
    },
    getLinks: async (page, selector) =>
        page.$$eval(selector, links => links.map(link => link.href)),
};
