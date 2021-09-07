const favouriteGenres = [
  'art',
  'biography',
  'business',
  'chick-lit',
  'children-s',
  'christian',
  'classics',
  'comics',
  'contemporary',
  'cookbooks',
  'crime',
  'ebooks',
  'fantasy',
  'fiction',
  'gay-and-lesbian',
  'graphic-novels',
  'historical-fiction',
  'history',
  'horror',
  'humor-and-comedy',
  'manga',
  'memoir',
  'music',
  'mystery',
  'non-fiction',
  'paranormal',
  'philosophy',
  'poetry',
  'psychology',
  'religion',
  'romance',
  'science',
  'science-fiction',
  'self-help',
  'suspense',
  'spirituality',
  'sports',
  'thriller',
  'travel',
  'young-adult',
  'queer',
  'lgbt',
];

require('./link-scraper-base')(
  {
    link: {
      $regex: `^(https://www.goodreads.com\/)(genres\/)(${favouriteGenres.join(
        '|',
      )})`,
    },
  },
  'linksScrapedAt',
  200,
);
// require('./link-scraper-base')(
//   {
//     link: {
//       $regex: `^(https://www.goodreads.com\/)(genres\/|genres\/new_releases\/|genres\/most_read\/|shelf\/show\/)(${favouriteGenres.join(
//         '|',
//       )})`,
//     },
//   },
//   'linksScrapedAt',
//   200,
// );
// require('./link-scraper-base')({ link: { $regex: '^(https:\/\/www.goodreads.com\/)(genres)' } }, 'linksScrapedAt', 100);
// require('./link-scraper-base')({link: {$regex: '^(https:\/\/www.goodreads.com\/)(genres|shelf\/show)'}}, 'linksScrapedAt', 500);
// require('./link-scraper-base')({link: {$regex: '^(https:\/\/www.goodreads.com\/)(list|genres|shelf\/show|shelf[?]|list\/show)'}}, 'linksScrapedAt', 5000);
