exports.sleep = delay => new Promise(resolve => setTimeout(resolve, delay));

exports.filterObject = (obj, allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.omitKeyValuePairs = (obj, fieldsToOmit) => {
  return fieldsToOmit.reduce(
    (acc, field) => {
      const newData = { ...acc };
      delete newData[field];
      return newData;
    },
    { ...obj },
  );
};

exports.scrapeHandler = links =>
  links
    .filter(el =>
      new RegExp(
        /^(|list\/show_tag|shelf\/show|list\/tag|new_releases|most_read)[\/?#]/,
      ).test(el.href.toLowerCase()),
    )
    .map(el => {
      let url = el.href.toLowerCase();
      url = url.split('#')[0];
      if (url.includes('book/show')) {
        url = url.split('?')[0];
      }
      if (!url.startsWith('https://www.goodreads.com')) {
        url = 'https://www.goodreads.com' + url;
      }
      return url;
    });

exports.shuffleArray = array => {
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
