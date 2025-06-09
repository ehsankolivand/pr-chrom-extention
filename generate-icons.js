const sharp = require('sharp');
const sizes = [16, 48, 128];
sizes.forEach(size => {
  sharp('icons/icon.svg')
    .resize(size, size)
    .png()
    .toFile(`icons/icon${size}.png`)
    .then(() => console.log(`icons/icon${size}.png created`))
    .catch(err => console.error(err));
}); 