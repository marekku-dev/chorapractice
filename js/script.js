document.addEventListener('DOMContentLoaded', () => {
  const slides = document.querySelectorAll('#gallery > picture');
  if (slides.length < 2) return;

  const INTERVAL = 5000; // ms between slides
  let current = 0;

  setInterval(() => {
    slides[current].classList.remove('active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('active');
  }, INTERVAL);
});
