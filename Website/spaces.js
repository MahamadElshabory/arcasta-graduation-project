// spaces.js
const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  endpoint: process.env.DO_SPACES_ENDPOINT, // e.g. https://fra1.digitaloceanspaces.com
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  signatureVersion: "v4",
  s3ForcePathStyle: false, // use virtual-hosted style: bucket.endpoint
});

async function uploadBase64ToSpaces(base64, key) {
  const m = base64.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error("Invalid base64 data");
  const contentType = m[1];
  const buffer = Buffer.from(m[2], "base64");

  const { Location } = await s3
    .upload({
      Bucket: process.env.DO_SPACES_BUCKET, // 'arcasta'
      Key: key, // e.g. products/PRD123-0.jpg
      Body: buffer,
      ACL: "public-read",
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
    .promise();

  // Prefer CDN URL if configured
  if (process.env.DO_SPACES_CDN) {
    const url = new URL(Location); // https://arcasta.fra1.digitaloceanspaces.com/products/...
    // strip the /bucket/ part if present: /arcasta/products/... -> /products/...
    const path = url.pathname.replace(/^\/[^/]+\//, "/");
    return `${process.env.DO_SPACES_CDN}${path}`;
  }
  return Location;
}

module.exports = { uploadBase64ToSpaces };
