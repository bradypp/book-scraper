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
// Book specific regex not included list\/book, book\/shelves. Also, /shelf/
// Add not to include like ?json, add_to_favourite_genres
exports.scrapeHandler = links => {
  return links
    .filter(el => {
      if (!el || !el.href) {
        return false;
      }
      return new RegExp(
        /^(https:\/\/www.goodreads.com\/|\/)(book\/show|book\/popular_by_date|list\/show|genre|genres|recommendations|series|author\/show|choiceawards|list\/show_tag|shelf\/show|award\/show|genres\/new_releases|genres\/most_read|list\/recently_active_lists|list\/popular_lists|book\/popular_group_books|list\/tag|list\/best_of_month|list\/best_of_year|list\/best_of_century|list\/best_of_decade|list\/best_by_date)/,
      ).test(el.href.toLowerCase()) && !new RegExp(
        /^(https:\/\/www.goodreads.com).+(https:\/\/|http:\/\/|add_to_favourite_genres|format=json|original_shelf|shelf\/users|book\/show.+___\d)/,
      ).test(el.href.toLowerCase());
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
};

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
