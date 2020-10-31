module.exports = {
    emailInput: '#user_email',
    passwordInput: '#user_password',
    signInForm: 'form',
    genreName: '.genreHeader h1',
    genreLinks: '.shelfStat a',
    genreMoreLinks: '.moreLink a',
    genrePaginationLinks: 'a[href^="/shelf/show"]',
    bookLinks: 'a[href^="/book/show"].bookTitle',
    bookPage: [
        {
            name: 'cover',
            selector: '#coverImage',
        },
        {
            name: 'title',
            selector: '#bookTitle',
        },
        {
            name: 'series',
            selector: '#bookSeries',
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
    ],
};
