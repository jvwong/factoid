module.exports = Object.freeze({
  updateDelay: 1000,
  editAnimationDuration: 600,
  editAnimationEasing: 'linear',
  editAnimationColor: 'rgba(255, 255, 0, 0.5)',
  editAnimationWhite: 'rgba(255, 255, 255, 0.5)',
  associationSearchLimit: 10,
  tippyTopZIndex: 10001,
  tippyDefaults: {
    theme: 'light',
    placement: 'bottom',
    createPopperInstanceOnInit: true,
    animation: 'fade',
    animateFill: false,
    updateDuration: 250,
    duration: [ 250, 0 ],
    delay: [ 0, 0 ],
    hideDuration: 0, // necessary on tippy.js@2.0.9
    arrow: true,
    trigger: 'click',
    interactive: true,
    multiple: true,
    hideOnClick: true,
    dynamicInputDetection: true,
    zIndex: 9999,
    performance: true,
    touchHold: false,

    // These options should be enabled per-tippy, as needed
    sticky: false,
    livePlacement: false,
  }
});
