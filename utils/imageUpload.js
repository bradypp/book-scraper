const aws = require('aws-sdk');
const axios = require('axios');
const { PassThrough } = require('stream');

const imageUpload = async url => {
  try {
    aws.config.update({
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      region: 'eu-west-2',
    });

    const s3 = new aws.S3();
    const passThrough = new PassThrough();

    const response = await axios(url, { responseType: 'stream' });

    const uploadPromise = s3
      .upload({
        Bucket: 'bookrecommender',
        ACL:'public-read',
        Key: Date.now().toString(),
        ContentType: response.headers['content-type'],
        ContentLength: response.headers['content-length'],
        Body: passThrough,
      })
      .promise();

    response.data.pipe(passThrough);

    const awsResponse = await uploadPromise;
    return awsResponse.Location;
  } catch (error) {
    console.error(error);
  }
};

module.exports = imageUpload;
