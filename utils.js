/* 
    Example of using puppeteer to get element from xpath
        const res = await page.$x(xpath);
        console.log(await res[0].evaluate((x) => x.children));



    const getElementFromXPath = (xpath, isIteratable = false) => {
        return document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;
    };
*/

module.exports = {};
