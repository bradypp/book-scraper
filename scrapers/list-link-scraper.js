// require('./link-scraper-base')({ link: { $regex: '^(https:\/\/www.goodreads.com\/)(list\/recently_active_lists|list\/popular_lists|list\/tag|list\/best_of_month|list\/best_of_year|list\/best_of_century|list\/best_of_decade|list\/best_by_date)' } }, 'linksScrapedAt', 100);
require('./link-scraper-base')({ link: { $regex: '^(https:\/\/www.goodreads.com\/)(list)' } }, 'linksScrapedAt', 1000);
