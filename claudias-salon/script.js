// Sticky nav shadow
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
});

// Mobile menu
const burger = document.getElementById('navBurger');
const links = document.getElementById('navLinks');
if (burger) {
  burger.addEventListener('click', () => links.classList.toggle('open'));
  links.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => links.classList.remove('open'))
  );
}

// Year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// Reveal on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.12 });
document.querySelectorAll('section h2, .service-card, .team-card, .review-card, .gallery-item')
  .forEach(el => { el.classList.add('reveal'); observer.observe(el); });

// Contact form -> WhatsApp prefill
function handleContact(event) {
  event.preventDefault();
  const f = event.target;
  const name = f.name.value.trim();
  const contact = f.contact.value.trim();
  const stylist = f.stylist.value;
  const message = f.message.value.trim();

  const stylistText = {
    'egal': 'Egal / passend zum Kalender',
    'claudia': 'Claudia',
    'stylistin-2': 'Stylistin 2',
    'stylist-3': 'Stylist 3 (Herren)'
  }[stylist] || 'Egal';

  const text =
    `Hallo Claudia's Salon,%0A%0A` +
    `mein Name ist ${encodeURIComponent(name)}.%0A` +
    `Kontakt: ${encodeURIComponent(contact)}%0A` +
    `Wunsch-Stylist: ${encodeURIComponent(stylistText)}%0A%0A` +
    `${encodeURIComponent(message)}`;

  window.open(`https://wa.me/4928618053199?text=${text}`, '_blank');
  return false;
}
