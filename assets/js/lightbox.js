const lightboxImages = Array.from(document.querySelectorAll("[data-lightbox-image]"));
const lightbox = document.querySelector("[data-lightbox]");
const lightboxCurrent = document.querySelector("[data-lightbox-current]");
const lightboxCaption = document.querySelector("[data-lightbox-caption-current]");
const closeButton = document.querySelector("[data-lightbox-close]");
const previousButton = document.querySelector("[data-lightbox-prev]");
const nextButton = document.querySelector("[data-lightbox-next]");

let activeImages = [];
let currentIndex = 0;

function getCaption(image) {
  const explicitCaption = image.dataset.lightboxCaption;
  const figureCaption = image.closest("figure")?.querySelector("figcaption")?.textContent;

  return explicitCaption || figureCaption || image.alt;
}

function showImage(index) {
  currentIndex = (index + activeImages.length) % activeImages.length;
  const image = activeImages[currentIndex];

  lightboxCurrent.src = image.currentSrc || image.src;
  lightboxCurrent.alt = image.alt;
  lightboxCaption.textContent = getCaption(image);
}

function openLightbox(image) {
  const galleryName = image.dataset.lightboxGallery;
  activeImages = lightboxImages.filter((galleryImage) => galleryImage.dataset.lightboxGallery === galleryName);

  showImage(activeImages.indexOf(image));
  lightbox.hidden = false;
  document.body.classList.add("lightbox-open");
  closeButton.focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxCurrent.removeAttribute("src");
  lightboxCaption.textContent = "";
  document.body.classList.remove("lightbox-open");
}

if (lightbox && lightboxCurrent && lightboxCaption && closeButton && previousButton && nextButton) {
  lightboxImages.forEach((image) => {
    image.tabIndex = 0;
    image.setAttribute("role", "button");
    image.addEventListener("click", () => openLightbox(image));
    image.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLightbox(image);
      }
    });
  });

  closeButton.addEventListener("click", closeLightbox);
  previousButton.addEventListener("click", () => showImage(currentIndex - 1));
  nextButton.addEventListener("click", () => showImage(currentIndex + 1));

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (lightbox.hidden) return;

    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") showImage(currentIndex - 1);
    if (event.key === "ArrowRight") showImage(currentIndex + 1);
  });
}
