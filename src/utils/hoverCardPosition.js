// Fixed position for a hover card next to an element, kept inside the viewport
export const HOVER_CARD_WIDTH = 520;
const CARD_HEIGHT_ESTIMATE = 400;

export const getHoverCardPosition = (element) => {
  const rect = element.getBoundingClientRect();
  const margin = 12;
  let left = rect.left;
  if (left + HOVER_CARD_WIDTH > window.innerWidth - margin) {
    left = Math.max(margin, window.innerWidth - HOVER_CARD_WIDTH - margin);
  }
  let top = rect.bottom + 8;
  if (top + CARD_HEIGHT_ESTIMATE > window.innerHeight) {
    top = Math.max(margin, rect.top - CARD_HEIGHT_ESTIMATE - 8);
  }
  return { top, left };
};
