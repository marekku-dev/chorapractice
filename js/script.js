document.addEventListener('DOMContentLoaded', () => {
  const gallery = document.getElementById('gallery');
  const images = gallery.querySelectorAll('img');
  const count = images.length;

  images.forEach((img, i) => img.style.display = i === 0 ? 'block' : 'none');

  document.addEventListener('mousemove', (e) => {
    const index = Math.floor(e.clientX / window.innerWidth * count);
    images.forEach((img, i) => img.style.display = i === index ? 'block' : 'none');
  });
});