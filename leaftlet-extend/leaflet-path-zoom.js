/* global L:readonly */

'use strict';

/*
 * L.Handler.ScrollWheelZoom is used by * to enable mouse scroll wheel zoom on the map.
 */

// @namespace Path
// @section Interaction Options
L.Path.mergeOptions({
	// @section Mouse wheel options
	// @option scrollWheelZoom: Boolean|String = true
	// Whether the map can be zoomed by using the mouse wheel. If passed `'center'`,
	// it will zoom to the center of the view regardless of where the mouse was.
	scrollWheelZoom: true,

	// @option wheelDebounceTime: Number = 40
	// Limits the rate at which a wheel can fire (in milliseconds). By default
	// user can't zoom via wheel more often than once per 40 ms.
	wheelDebounceTime: 40,

	// @option wheelPxPerZoomLevel: Number = 60
	// How many scroll pixels (as reported by [L.DomEvent.getWheelDelta](#domevent-getwheeldelta))
	// mean a change of one full zoom level. Smaller values will make wheel-zooming
	// faster (and vice versa).
	wheelPxPerZoomLevel: 60,

	// @option zoom: Number = 0
	// Initial map zoom level
	zoom: 0,

	// @option minZoom: Number = *
	// Minimum zoom level of the map.
	// If not specified and at least one `GridLayer` or `TileLayer` is in the map,
	// the lowest of their `minZoom` options will be used instead.
	minZoom: undefined,

	// @option maxZoom: Number = *
	// Maximum zoom level of the map.
	// If not specified and at least one `GridLayer` or `TileLayer` is in the map,
	// the highest of their `maxZoom` options will be used instead.
	maxZoom: undefined,

	zoomSnap: 0,

	// @option asDelta: Boolean = true
	// Return value as the change in zoom instead of new zoom level
	asDelta: true,

	// @section Touch interaction options
	// @option touchZoom: Boolean|String = *
	// Whether the map can be zoomed by touch-dragging with two fingers. If
	// passed `'center'`, it will zoom to the center of the view regardless of
	// where the touch events (fingers) were. Enabled by default
	// for touch-capable web browsers.
	touchZoom: L.Browser.touch,

	// @option bounceAtZoomLimits: Boolean = true
	// Set it to false if you don't want the map to zoom beyond min/max zoom
	// and then bounce back when pinch-zooming.
	bounceAtZoomLimits: true,
});

L.Handler.PathScrollZoom = L.Handler.extend({
	initialize: function (path) {
		this._path = path;
		this._zoom = path.options.zoom;
	},
	getEvents: function () {
		return {
			zoom: this._onZoom,
		};
	},
	addHooks() {
		L.DomEvent.on(this._path._path, 'wheel', this._onZoom, this);

		this._delta = 0;
	},
	removeHooks() {
		L.DomEvent.off(this._path._path, 'wheel', this._onZoom, this);
	},

	// util
	_getZoom() {
		return this._zoom || this._path._map.getZoom();
	},

	// @method getMinZoom(): Number
	// Returns the minimum zoom level of the map (if set in the `minZoom` option of the map or of any layers), or `0` by default.
	_getMinZoom() {
		return this.options.minZoom === undefined
			? this._layersMinZoom || 0
			: this.options.minZoom;
	},

	// @method getMaxZoom(): Number
	// Returns the maximum zoom level of the map (if set in the `maxZoom` option of the map or of any layers).
	_getMaxZoom() {
		return this.options.maxZoom === undefined
			? this._layersMaxZoom === undefined
				? Infinity
				: this._layersMaxZoom
			: this.options.maxZoom;
	},
	_limitZoom(zoom) {
		const min = this._getMinZoom(),
			max = this._getMaxZoom(),
			snap = this.options.zoomSnap;
		if (snap) {
			zoom = Math.round(zoom / snap) * snap;
		}
		return Math.max(min, Math.min(max, zoom));
	},

	// handling
	_onZoom(e) {
		const delta = L.DomEvent.getWheelDelta(e);

		const debounce = this._path.options.wheelDebounceTime;

		this._delta += delta;
		this._lastMousePos = L.DomEvent.getMousePosition(e, this._container);

		if (!this._startTime) {
			this._startTime = +new Date();
		}

		const left = Math.max(debounce - (+new Date() - this._startTime), 0);

		clearTimeout(this._timer);
		this._timer = setTimeout(this._performZoom.bind(this), left);

		L.DomEvent.stop(e);
	},

	_performZoom() {
		const path = this._path,
			zoom = this._getZoom(),
			snap = this.options.zoomSnap;

		// TODO? From Map
		// path._stop(); // stop panning and fly animations if any

		// map the delta with a sigmoid function to -4..4 range leaning on -1..1
		const d2 = this._delta / (path.options.wheelPxPerZoomLevel * 4);
		const d3 = (4 * Math.log(2 / (1 + Math.exp(-Math.abs(d2))))) / Math.LN2;
		const d4 = snap ? Math.ceil(d3 / snap) * snap : d3;
		const delta = this._limitZoom(zoom + (this._delta > 0 ? d4 : -d4)) - zoom;

		this._delta = 0;
		this._startTime = null;

		if (!delta) {
			return;
		}

		let newZoom = zoom + delta;
		if (path.options.asDelta) {
			newZoom = delta;
		}

		this._zoom = newZoom;
		if (path.options.scrollWheelZoom === 'center') {
			path.fire('zoom', newZoom);
		} else {
			path.fire('zoom', {mousePos: this._lastMousePos, zoom: newZoom});
		}
	},
});

// @section Handlers
// @property scrollWheelZoom: Handler
// Scroll wheel zoom handler.
L.Path.addInitHook(function () {
	if (this.options.zoomable) {
		this.zoomable = new L.Handler.PathScrollZoom(this);
		this.once('add', function () {
			this.zoomable.enable();
		});
	}
});
