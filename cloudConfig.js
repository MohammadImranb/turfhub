const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

//Credentials come from .env only. They must never be hardcoded here - this file is
//committed to git, so a literal api_secret would be published with the repo.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

//fail loudly at boot rather than silently at the first upload
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_KEY || !process.env.CLOUDINARY_SECRET) {
  console.warn("WARNING: CLOUDINARY_* not set in .env - image uploads will fail.");
}

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "turfs",
    allowed_formats: ["png", "jpg", "jpeg", "webp"],
  },
});

module.exports = { cloudinary, storage };
