module.exports = {
    genresPage: '.shelfStat a',
    genresMore: '.moreLink a',
    genresPagination: 'a[href^="/shelf/show"]',
    booksLinks: 'a[href^="/book/show"].bookTitle',
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
    ],
};
