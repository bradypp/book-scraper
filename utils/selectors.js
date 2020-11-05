module.exports = {
    emailInput: '#user_email',
    passwordInput: '#user_password',
    signInForm: 'form',
    genreName: '.genreHeader h1',
    genreLinks: '.shelfStat a',
    genreMoreLinks: '.moreLink a',
    genrePaginationLinks: 'a[href^="/shelf/show"]',
    bookLinks: 'a[href^="/book/show"].bookTitle',
    tags: '.mainContent .leftContainer a',
    bookPage: [
        {
            name: 'coverImage',
            selector: '#coverImage',
        },
        {
            name: 'series',
            selector: '#bookSeries a',
        },
        {
            name: 'authors',
            isIteratable: true,
            selector: '#bookAuthors a',
        },
        {
            name: 'description',
            isIteratable: true,
            selector: '#description > span',
        },
        {
            name: 'ratingValue',
            selector: 'span[itemprop="ratingValue"]',
        },
        {
            name: 'ratingCount',
            selector: 'meta[itemprop="ratingCount"]',
        },
        {
            name: 'relatedBooks',
            isIteratable: true,
            selector: '[id^="relatedWorks"] li a',
        },
        {
            name: 'goodreadsId',
            selector: '[data-book-id]',
        },
        {
            name: 'bookEdition',
            selector: '[itemprop="bookEdition"]',
        },
        {
            name: 'bookFormat',
            selector: '[itemprop="bookFormat"]',
        },
        {
            name: 'numberOfPages',
            selector: '[itemprop="numberOfPages"]',
        },
        {
            name: 'reviewCount',
            selector: 'meta[itemprop="reviewCount"]',
        },
        {
            name: 'details',
            selector: '#details',
        },
        {
            name: 'isbn',
            selector: 'meta[property="books:isbn"]',
        },
        {
            name: 'genres',
            isIteratable: true,
            selector: '.rightContainer .left .bookPageGenreLink',
        },
        {
            name: 'tagsLink',
            selector: '.rightContainer .elementList+.seeMoreLink',
        },
    ],
};
