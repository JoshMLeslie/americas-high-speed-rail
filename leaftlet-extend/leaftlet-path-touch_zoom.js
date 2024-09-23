/* global L:readonly */

'use strict';

/*
 * L.Handler.TouchZoom is used by * to enable touch scroll on the path.
 */

// @namespace Path
// @section Interaction Options
L.Path.mergeOptions({
	// @option zoomable: Boolean = false
	// Whether the element (Path) is zoomable or not
	zoomable: false,
	
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

L.Handler.PathTouchZoom = L.Handler.extend({
	initialize: function (path) {
		console.warn("incomplete testing on/bc desktop; errors likely");

		this._path = path;
		this._zoom = path.options.zoom;
	},
	addHooks() {
		// TBD
		// this._path._path.classList.add('leaflet-touch-zoom');
		L.DomEvent.on(this._path._path, 'touchstart', this._onTouchStart, this);
	},
	removeHooks() {
		// TBD
		// this._path._path.classList.remove('leaflet-touch-zoom');
		L.DomEvent.off(this._path._path, 'touchstart', this._onTouchStart, this);
	},

	// util
	_getMap() {
		return this._path._map;
	},
	
	_getZoom() {
		return this._zoom || this._getMap().getZoom();
	},

	getScaleZoom(scale, fromZoom) {
		const crs = this._getMap().options.crs;
		fromZoom = fromZoom === undefined ? this._zoom : fromZoom;
		const zoom = crs.zoom(scale * crs.scale(fromZoom));
		return isNaN(zoom) ? Infinity : zoom;
	},

	// Touch handling
	_onTouchStart(e) {
		const path = this._path;

		if (
			!e.touches ||
			// e.touches.length !== 2 || // debug
			path._animatingZoom ||
			this._zooming
		) {
			return;
		}

		const p1 = L.DomEvent.getMousePosition(e.touches[0], this._container);
		const p2 = L.DomEvent.getMousePosition(e.touches[1], this._container);

		this._centerPoint = path.getCenter(); // LatLng
		this._startLatLng = path.getCenter(); // LatLng
		if (path.options.touchZoom !== 'center') {
			this._pinchStartLatLng = p1.add(p2)._divideBy(2);
		}

		this._startDist = p1.distanceTo(p2);
		this._startZoom = this._getZoom();

		this._moved = false;
		this._zooming = true;

		// TBD
		// path._stop();

		L.DomEvent.on(document, 'touchmove', this._onTouchMove, this);
		L.DomEvent.on(document, 'touchend touchcancel', this._onTouchEnd, this);

		L.DomEvent.preventDefault(e);
	},

	_onTouchMove(e) {
		const path = this._path,
			p1 = L.DomEvent.getMousePosition(e.touches[0]),
			p2 = L.DomEvent.getMousePosition(e.touches[1]),
			scale = p1.distanceTo(p2) / this._startDist;

		this._zoom = this.getScaleZoom(scale, this._startZoom);

		if (
			!path.options.bounceAtZoomLimits &&
			((this._zoom < path.getMinZoom() && scale < 1) ||
				(this._zoom > path.getMaxZoom() && scale > 1))
		) {
			this._zoom = path._limitZoom(this._zoom);
		}

		if (path.options.touchZoom === 'center') {
			this._center = this._startLatLng;
			if (scale === 1) {
				return;
			}
		} else {
			// Get delta from pinch to center, so centerLatLng is delta applied to initial pinchLatLng
			const delta = p1._add(p2)._divideBy(2)._subtract(this._centerPoint);
			if (scale === 1 && delta.x === 0 && delta.y === 0) {
				return;
			}
			this._center = this._getMap().unproject(
				this._getMap().project(this._pinchStartLatLng, this._zoom).subtract(delta),
				this._zoom
			);
		}

		if (!this._moved) {
			path._moveStart(true, false);
			this._moved = true;
		}

		Util.cancelAnimFrame(this._animRequest);

		const moveFn = path._move.bind(
			path,
			this._center,
			this._zoom,
			{pinch: true, round: false},
			undefined
		);
		this._animRequest = Util.requestAnimFrame(moveFn, this);

		DomEvent.preventDefault(e);
	},

	_onTouchEnd() {
		if (!this._moved || !this._zooming) {
			this._zooming = false;
			return;
		}

		this._zooming = false;
		Util.cancelAnimFrame(this._animRequest);

		DomEvent.off(document, 'touchmove', this._onTouchMove, this);
		DomEvent.off(document, 'touchend touchcancel', this._onTouchEnd, this);

		// Pinch updates GridLayers' levels only when zoomSnap is off, so zoomSnap becomes noUpdate.
		if (this._path.options.zoomAnimation) {
			this._path._animateZoom(
				this._center,
				this._path._limitZoom(this._zoom),
				true,
				this._path.options.zoomSnap
			);
		} else {
			this._path._resetView(this._center, this._map._limitZoom(this._zoom));
		}
	},
});

// @section Handlers
// @property scrollWheelZoom: Handler
// Scroll wheel zoom handler.
L.Path.addInitHook(function () {
	if (this.options.zoomable) {
		if (this.options.touchZoom) {
			this.touchZoom = new L.Handler.PathTouchZoom(this);
			this.once('add', function () {
				this.touchZoom.enable();
			});
		}
	}
});
