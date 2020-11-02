const moment = require('moment');

const dateApi = moment('May 2002', ['MMMM Do YYYY', 'MMMM YYYY', 'YYYY']).utc().format();
const dateClient = moment(dateApi).format('MMMM YYYY')

console.log(dateApi);
