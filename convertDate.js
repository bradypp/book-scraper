const moment = require('moment');

const dateApi = moment('May 4th 2002', 'MMMM Do YYYY').utc().format();
const dateClient = moment(dateApi).toDate()

console.log(dateClient === new Date(dateClient));
