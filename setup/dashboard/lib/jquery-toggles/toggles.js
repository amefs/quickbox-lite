/**
@license jQuery Toggles v3.1.5
Copyright 2012 - 2015 Simon Tabor - MIT License
https://github.com/simontabor/jquery-toggles / http://simontabor.com/labs/toggles
*/

(function(root) {

  var factory = function($) {

var Toggles = root['Toggles'] = function(el, opts) {
  var self = this;

  if (typeof opts === 'boolean' && el.data('toggles')) {
    el.data('toggles').toggle(opts);
    return;
  }

  var dataAttr = [ 'on', 'drag', 'click', 'width', 'height', 'animate', 'easing', 'type', 'checkbox' ];
  var dataOpts = {};
  for (var i = 0; i < dataAttr.length; i++) {
    var opt = el.data('toggle-' + dataAttr[i]);
    if (typeof opt !== 'undefined') dataOpts[dataAttr[i]] = opt;
  }

  // extend default opts with the users options
  opts = self.opts = $.extend({
    // can the toggle be dragged
    'drag': true,
    // can it be clicked to toggle
    'click': true,
    'text': {
      // text for the ON/OFF position
      'on': 'ENABLED',
      'off': 'DISABLED'
    },
    // is the toggle ON on init
    'on': false,
    // animation time (ms)
    'animate': 250,
     // animation transition,
    'easing': 'swing',
    // the checkbox to toggle (for use in forms)
    'checkbox': null,
    // element that can be clicked on to toggle. removes binding from the toggle itself (use nesting)
    'clicker': null,
    // width used if not set in css
    'width': 100,
    // height if not set in css
    'height': 20,
    // defaults to a compact toggle, other option is 'select' where both options are shown at once
    'type': 'compact',
    // the event name to fire when we toggle
    'event': 'toggle'
  }, opts || {}, dataOpts);

  self.el = el;

  el.data('toggles', self);

  self.selectType = opts['type'] === 'select';

  // make checkbox a jquery element
  self.checkbox = $(opts['checkbox']);

  // leave as undefined if not set
  if (opts['clicker']) self.clicker = $(opts['clicker']);

  self.createEl();
  self.bindEvents();

  // set active to the opposite of what we want, so toggle will run properly
  self['active'] = !opts['on'];

  // toggle the toggle to the correct state with no animation and no event
  self.toggle(opts['on'], true, true);
};

Toggles.prototype.createEl = function() {
  var self = this;

  var height = self.el.height();
  var width = self.el.width();

  // if the element doesnt have an explicit height/width in css, set them
  if (!height) self.el.height(height = self.opts['height']);
  if (!width) self.el.width(width = self.opts['width']);

  self.h = height;
  self.w = width;

  var div = function(name) {
    return $('<div class="toggle-' + name +'">');
  };

  self.els = {
    // wrapper inside toggle
    slide: div('slide'),

    // inside slide, this bit moves
    inner: div('inner'),

    // the on/off divs
    on: div('on'),
    off: div('off'),

    // the grip to drag the toggle
    blob: div('blob')
  };

  var halfHeight = height / 2;
  var onOffWidth = width - halfHeight;

  var isSelect = self.selectType;

  // set up the CSS for the individual elements
  self.els.on
    .css({
      height: height,
      width: onOffWidth,
      textIndent: isSelect ? '' : -halfHeight,
      lineHeight: height + 'px'
    })
    .html(self.opts['text']['on']);

  self.els.off
    .css({
      height: height,
      width: onOffWidth,
      marginLeft: isSelect ? '' : -halfHeight,
      textIndent: isSelect ? '' : halfHeight,
      lineHeight: height + 'px'
    })
    .html(self.opts['text']['off']);

  self.els.blob.css({
    height: height,
    width: height,
    marginLeft: -halfHeight
  });

  self.els.inner.css({
    width: width * 2 - height,
    marginLeft: (isSelect || self['active']) ? 0 : -width + height
  });

  if (self.selectType) {
    self.els.slide.addClass('toggle-select');
    self.el.css('width', onOffWidth * 2);
    self.els.blob.hide();
  }

  // construct the toggle
  self.els.inner.append(self.els.on, self.els.blob, self.els.off);
  self.els.slide.html(self.els.inner);
  self.el.html(self.els.slide);
};

Toggles.prototype.bindEvents = function() {
  var self = this;

  // evt handler for click events
  var clickHandler = function(e) {

    // if the target isn't the blob or dragging is disabled, toggle!
    if (e['target'] !== self.els.blob[0] || !self.opts['drag']) {
      self.toggle();
    }
  };

  // if click is enabled and toggle isn't within the clicker element (stops double binding)
  if (self.opts['click'] && (!self.opts['clicker'] || !self.opts['clicker'].has(self.el).length)) {
    self.el.on('click', clickHandler);
  }

  // setup the clicker element
  if (self.opts['clicker']) {
    self.opts['clicker'].on('click', clickHandler);
  }

  // bind up dragging stuff
  if (self.opts['drag'] && !self.selectType) self.bindDrag();
};

Toggles.prototype.bindDrag = function() {
  var self = this;

  // time to begin the dragging parts/blob clicks
  var diff;
  var slideLimit = (self.w - self.h) / 4;

  // fired on mouseup and mouseleave events
  var upLeave = function(e) {
    self.el.off('mousemove');
    self.els.slide.off('mouseleave');
    self.els.blob.off('mouseup');

    if (!diff && self.opts['click'] && e.type !== 'mouseleave') {
      self.toggle();
      return;
    }

    var overBound = self['active'] ? diff < -slideLimit : diff > slideLimit;
    if (overBound) {
      // dragged far enough, toggle
      self.toggle();
    } else {
      // reset to previous state
      self.els.inner.stop().animate({
        marginLeft: self['active'] ? 0 : -self.w + self.h
      }, self.opts['animate'] / 2);
    }
  };

  var wh = -self.w + self.h;

  self.els.blob.on('mousedown', function(e) {

    // reset diff
    diff = 0;

    self.els.blob.off('mouseup');
    self.els.slide.off('mouseleave');
    var cursor = e.pageX;

    self.el.on('mousemove', self.els.blob, function(e) {
      diff = e.pageX - cursor;
      var marginLeft;


      if (self['active']) {

        marginLeft = diff;

        // keep it within the limits
        if (diff > 0) marginLeft = 0;
        if (diff < wh) marginLeft = wh;
      } else {

        marginLeft = diff + wh;

        if (diff < 0) marginLeft = wh;
        if (diff > -wh) marginLeft = 0;

      }

      self.els.inner.css('margin-left',marginLeft);
    });

    self.els.blob.on('mouseup', upLeave);
    self.els.slide.on('mouseleave', upLeave);
  });
};

Toggles.prototype.toggle = function(state, noAnimate, noEvent) {
  var self = this;

  // check we arent already in the desired state
  if (self['active'] === state) return;

  var active = self['active'] = !self['active'];

  self.el.data('toggle-active', active);

  self.els.off.toggleClass('active', !active);
  self.els.on.toggleClass('active', active);
  self.checkbox.prop('checked', active);

  if (!noEvent) self.el.trigger(self.opts['event'], active);

  if (self.selectType) return;

  var margin = active ? 0 : -self.w + self.h;

  // move the toggle!
  self.els.inner.stop().animate({
    'marginLeft': margin
  }, noAnimate ? 0 : self.opts['animate']);
};

    $.fn['toggles'] = function(opts) {
      return this.each(function() {
        new Toggles($(this), opts);
      });
    };
  };

  if (typeof define === 'function' && define['amd']) {
    define(['jquery'], factory);
  } else {
    factory(root['jQuery'] || root['Zepto'] || root['ender'] || root['$'] || $);
  }

})(this);
