document.addEventListener('DOMContentLoaded', () => {
  const slides = document.querySelectorAll('#gallery > picture');
  if (slides.length < 2) return;

  const INTERVAL = 5000; // ms between slides
  let current = Array.from(slides).findIndex(s => s.classList.contains('active'));
  if (current === -1) {
    current = 0;
    slides[0].classList.add('active');
  }

  setInterval(() => {
    slides[current].classList.remove('active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('active');
  }, INTERVAL);
});
